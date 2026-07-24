from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db.models import Q, Avg
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Category, ProviderService, Booking, Review, Message, Notification, ProviderAvailability
from .serializers import CategorySerializer, ProviderServiceSerializer, BookingSerializer, ReviewSerializer, MessageSerializer, NotificationSerializer, ProviderAvailabilitySerializer

def broadcast_notification(notification):
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"user_notifications_{notification.user.id}",
                {
                    "type": "notification_event",
                    "notification": NotificationSerializer(notification).data
                }
            )
    except Exception as e:
        print("Failed to broadcast notification via WebSockets:", e)

def _dispatch_simple_email(recipient_email, subject, message):
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@servicehub.com')
        send_mail(subject, message, from_email, [recipient_email], fail_silently=True)
    except Exception as e:
        print("Transactional email dispatch error:", e)

def send_transactional_email(recipient_email, subject, message):
    if not recipient_email:
        return
    import threading
    threading.Thread(target=_dispatch_simple_email, args=(recipient_email, subject, message), daemon=True).start()


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class ProviderServiceListCreateView(generics.ListCreateAPIView):
    serializer_class = ProviderServiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProviderService.objects.filter(provider=self.request.user.provider_profile)

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user.provider_profile)

class ProviderServiceDestroyView(generics.DestroyAPIView):
    serializer_class = ProviderServiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ProviderService.objects.filter(provider=self.request.user.provider_profile)

class ProviderSearchAPIView(generics.ListAPIView):
    serializer_class = ProviderServiceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        service_id = self.request.query_params.get('service_id')
        max_price = self.request.query_params.get('max_price')
        min_rating = self.request.query_params.get('min_rating')
        sort_by = self.request.query_params.get('sort_by')
        location = self.request.query_params.get('location')

        if not service_id:
            return ProviderService.objects.none()

        # Base queryset: only include active providers who have a city set
        queryset = ProviderService.objects.filter(service_id=service_id, provider__user__is_active=True).exclude(provider__city__isnull=True).exclude(provider__city__exact='')

        # Annotate with average rating
        queryset = queryset.annotate(
            avg_rating=Avg('provider__offered_services__bookings__review__rating')
        )

        # Apply location filter
        if location:
            queryset = queryset.filter(provider__city__icontains=location)

        # Apply price filter
        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except ValueError:
                pass

        # Apply rating filter
        if min_rating:
            try:
                queryset = queryset.filter(avg_rating__gte=float(min_rating))
            except ValueError:
                pass

        # Apply sorting
        if sort_by == 'price_asc':
            queryset = queryset.order_by('price')
        elif sort_by == 'price_desc':
            queryset = queryset.order_by('-price')
        elif sort_by == 'rating_desc':
            # Handle null avg_rating gracefully (F expressions or simple fallback)
            # -avg_rating works in Django, but nulls come first/last depending on DB
            queryset = queryset.order_by('-avg_rating', 'price')
        
        return queryset

class BookingListCreateView(generics.ListCreateAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_qs = Booking.objects.select_related(
            'customer', 'customer__user', 
            'provider_service', 'provider_service__service', 
            'provider_service__provider', 'provider_service__provider__user'
        )
        if user.is_customer:
            return base_qs.filter(customer=user.customer_profile).order_by('-created_at')
        elif user.is_provider:
            return base_qs.filter(provider_service__provider=user.provider_profile).order_by('-created_at')
        return Booking.objects.none()

    def perform_create(self, serializer):
        # Ensure only customers can create bookings
        if not self.request.user.is_customer:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only customers can create bookings.")
        
        customer_profile = self.request.user.customer_profile
        provider_service = serializer.validated_data.get('provider_service')
        booking_date = serializer.validated_data.get('booking_date')

        # Duplicate Booking Protection
        if provider_service and booking_date:
            existing_duplicate = Booking.objects.filter(
                customer=customer_profile,
                provider_service=provider_service,
                booking_date=booking_date,
                status__in=['pending', 'accepted']
            ).first()

            if existing_duplicate:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"non_field_errors": ["A booking request for this slot has already been submitted."]})

        booking = serializer.save(customer=customer_profile)
        
        # Trigger Notification for Provider
        notif = Notification.objects.create(
            user=booking.provider_service.provider.user,
            title="New Job Request",
            message=f"{self.request.user.first_name} has requested your {booking.provider_service.service.name} service.",
            link="/provider-dashboard"
        )
        broadcast_notification(notif)

        # Dispatch Professional HTML Emails to Provider and Customer
        try:
            from services.email_utils import send_professional_email
            provider_user = booking.provider_service.provider.user
            customer_user = self.request.user
            booking_date_str = booking.booking_date.strftime("%b %d, %Y at %I:%M %p") if booking.booking_date else "N/A"

            # 1. Email to Provider
            send_professional_email(
                recipient_email=provider_user.email,
                recipient_name=provider_user.first_name or provider_user.username,
                subject=f"New Job Request Received — {booking.provider_service.service.name} (#BK-{booking.id})",
                badge_text="NEW REQUEST",
                badge_bg="#4f46e5",
                main_message=f"{customer_user.first_name} {customer_user.last_name} has requested a new booking for your {booking.provider_service.service.name} service.",
                details_dict={
                    "Booking Ref": f"#BK-{booking.id}",
                    "Service Name": booking.provider_service.service.name,
                    "Customer Name": f"{customer_user.first_name} {customer_user.last_name}",
                    "Customer Phone": customer_user.customer_profile.phone_number or "N/A",
                    "Scheduled Time": booking_date_str,
                    "Service Address": booking.address,
                    "Problem Note": booking.problem_description or "None provided"
                }
            )

            # 2. Email to Customer
            send_professional_email(
                recipient_email=customer_user.email,
                recipient_name=customer_user.first_name or customer_user.username,
                subject=f"Booking Request Submitted — {booking.provider_service.service.name} (#BK-{booking.id})",
                badge_text="REQUEST SUBMITTED",
                badge_bg="#0284c7",
                main_message=f"Your booking request for {booking.provider_service.service.name} has been submitted to {provider_user.first_name} {provider_user.last_name}. We will notify you as soon as the provider accepts!",
                details_dict={
                    "Booking Ref": f"#BK-{booking.id}",
                    "Service Name": booking.provider_service.service.name,
                    "Professional": f"{provider_user.first_name} {provider_user.last_name}",
                    "Scheduled Time": booking_date_str,
                    "Total Price": f"₹{booking.provider_service.price}",
                    "Service Address": booking.address
                }
            )
        except Exception as e:
            print("Failed to send professional booking emails:", e)

class BookingStatusUpdateView(generics.UpdateAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_customer:
            return Booking.objects.filter(customer=user.customer_profile)
        elif user.is_provider:
            return Booking.objects.filter(provider_service__provider=user.provider_profile)
        return Booking.objects.none()
    
    def perform_update(self, serializer):
        user = self.request.user
        booking = serializer.instance
        new_status = self.request.data.get('status', booking.status)
        
        if user.is_customer:
            # Customer can only cancel bookings
            if new_status != 'cancelled':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Customers can only cancel bookings.")
            if booking.status in ['completed', 'cancelled']:
                from rest_framework.exceptions import ValidationError
                raise ValidationError("Cannot cancel a completed or already cancelled booking.")
        
        old_status = booking.status
        updated_booking = serializer.save(status=new_status)
        
        # When booking status becomes completed or cancelled, automatically delete all chat messages
        if new_status in ['completed', 'cancelled']:
            from services.models import Message
            Message.objects.filter(booking=updated_booking).delete()

        # If marked completed and payment method was cash, automatically mark as paid
        if user.is_provider and new_status == 'completed' and updated_booking.payment_method == 'cash' and updated_booking.payment_status != 'paid':
            updated_booking.payment_status = 'paid'
            updated_booking.save()
            
            # Send Notification to customer about payment confirmation
            notif1 = Notification.objects.create(
                user=updated_booking.customer.user,
                title="Payment Confirmed",
                message=f"Your cash payment of ₹{updated_booking.provider_service.price} for Booking #BK-{updated_booking.id} was confirmed by the provider.",
                link="/customer-dashboard"
            )
            broadcast_notification(notif1)

            # Send Professional HTML Payment Email
            try:
                from services.email_utils import send_professional_email
                send_professional_email(
                    recipient_email=updated_booking.customer.user.email,
                    recipient_name=updated_booking.customer.user.first_name or updated_booking.customer.user.username,
                    subject=f"ServiceHub — Cash Payment Confirmed (#BK-{updated_booking.id})",
                    badge_text="PAYMENT CONFIRMED",
                    badge_bg="#059669",
                    main_message=f"Your cash payment of ₹{updated_booking.provider_service.price} for Booking #BK-{updated_booking.id} was confirmed by the service provider.",
                    details_dict={
                        "Booking Ref": f"#BK-{updated_booking.id}",
                        "Service Name": updated_booking.provider_service.service.name,
                        "Amount Paid": f"₹{updated_booking.provider_service.price}",
                        "Payment Method": "CASH ON SERVICE",
                        "Payment Status": "PAID"
                    }
                )
            except Exception as e:
                print("Failed to send cash payment HTML email:", e)
        
        if old_status != new_status:
            # Send notification to the other participant
            recipient = updated_booking.provider_service.provider.user if user.is_customer else updated_booking.customer.user
            role_name = "Customer" if user.is_customer else "Provider"
            
            notif2 = Notification.objects.create(
                user=recipient,
                title=f"Booking {new_status.title()}",
                message=f"Booking #BK-{updated_booking.id} for {updated_booking.provider_service.service.name} was marked as {new_status} by the {role_name}.",
                link="/provider-dashboard" if user.is_customer else "/customer-dashboard"
            )
            broadcast_notification(notif2)

            # Send Professional HTML Email Notification for Status Update
            try:
                from services.email_utils import send_professional_email
                booking_date_str = updated_booking.booking_date.strftime("%b %d, %Y at %I:%M %p") if updated_booking.booking_date else "N/A"
                provider_user = updated_booking.provider_service.provider.user
                customer_user = updated_booking.customer.user

                badge_bg_color = (
                    "#059669" if new_status == "accepted" else
                    "#4f46e5" if new_status == "completed" else
                    "#dc2626"
                )

                send_professional_email(
                    recipient_email=recipient.email,
                    recipient_name=recipient.first_name or recipient.username,
                    subject=f"ServiceHub — Booking #BK-{updated_booking.id} is now {new_status.upper()}",
                    badge_text=f"BOOKING {new_status.upper()}",
                    badge_bg=badge_bg_color,
                    main_message=f"Your Booking #BK-{updated_booking.id} for {updated_booking.provider_service.service.name} has been updated to {new_status.upper()} by the {role_name}.",
                    details_dict={
                        "Booking Ref": f"#BK-{updated_booking.id}",
                        "Service Name": updated_booking.provider_service.service.name,
                        "Professional": f"{provider_user.first_name} {provider_user.last_name}",
                        "Customer Name": f"{customer_user.first_name} {customer_user.last_name}",
                        "Status": new_status.upper(),
                        "Scheduled Time": booking_date_str,
                        "Price": f"₹{updated_booking.provider_service.price}"
                    }
                )
            except Exception as e:
                print("Failed to send status update HTML email:", e)

class ReviewCreateView(generics.CreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        booking_id = self.request.data.get('booking')
        
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            raise ValidationError("Booking does not exist.")

        if booking.customer != self.request.user.customer_profile:
            raise ValidationError("You can only review your own bookings.")
            
        if booking.status != 'completed':
            raise ValidationError("You can only review completed jobs.")
            
        if hasattr(booking, 'review'):
            raise ValidationError("This booking has already been reviewed.")

        review = serializer.save()
        
        Notification.objects.create(
            user=booking.provider_service.provider.user,
            title="New Review Received",
            message=f"{self.request.user.first_name} left a {review.rating}-star review for your {booking.provider_service.service.name} service.",
            link="/provider-dashboard"
        )

class ProviderReviewListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Fetch reviews for the currently logged in provider
        return Review.objects.filter(booking__provider_service__provider=self.request.user.provider_profile).order_by('-created_at')

class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        booking_id = self.request.query_params.get('booking_id')
        if not booking_id:
            return Message.objects.none()

        # Ensure user is part of the booking
        user = self.request.user
        queryset = Message.objects.filter(booking_id=booking_id).order_by('timestamp')
        
        # Security check: User must be either the customer or the provider of the booking
        # Since we just need to return messages if they have access, we filter by their role:
        if user.is_customer:
            queryset = queryset.filter(booking__customer=user.customer_profile)
        elif user.is_provider:
            queryset = queryset.filter(booking__provider_service__provider=user.provider_profile)
        else:
            queryset = Message.objects.none()
            
        return queryset

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        booking_id = self.request.data.get('booking')
        if not booking_id:
            raise ValidationError("Booking ID is required.")
            
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            raise ValidationError("Booking does not exist.")

        # Ensure user is part of the booking
        user = self.request.user
        if user.is_customer and booking.customer != user.customer_profile:
            raise ValidationError("You are not part of this booking.")
        elif user.is_provider and booking.provider_service.provider != user.provider_profile:
            raise ValidationError("You are not part of this booking.")

        if booking.status in ['completed', 'cancelled']:
            raise ValidationError("Chat is closed for completed or cancelled bookings.")
            
        serializer.save(sender=user)

class MessageDeleteAPIView(generics.DestroyAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # A user can only delete their own messages
        return Message.objects.filter(sender=self.request.user)

class NotificationListAPIView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

class NotificationMarkReadAPIView(generics.UpdateAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(is_read=True)

class NotificationDeleteAPIView(generics.DestroyAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

from rest_framework.views import APIView
from rest_framework.response import Response

class NotificationClearAllAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        Notification.objects.filter(user=request.user).delete()
        return Response({"detail": "All notifications cleared."})

class BookingPayAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            raise ValidationError("Booking does not exist.")

        if not request.user.is_customer or booking.customer != request.user.customer_profile:
            raise ValidationError("You can only pay for your own bookings.")

        payment_method = request.data.get('payment_method', 'card')

        if payment_method not in ['card', 'upi', 'cash']:
            raise ValidationError("Invalid payment method.")

        if payment_method == 'cash':
            booking.payment_method = 'cash'
            booking.payment_status = 'unpaid'
            booking.save()

            # Send Notification to the provider
            n_cash = Notification.objects.create(
                user=booking.provider_service.provider.user,
                title="Cash Payment Selected",
                message=f"{request.user.first_name} selected Cash on Service for Booking #BK-{booking.id}.",
                link="/provider-dashboard"
            )
            broadcast_notification(n_cash)
        else:
            if booking.payment_status == 'paid':
                raise ValidationError("This booking has already been paid.")

            booking.payment_method = payment_method
            booking.payment_status = 'paid'
            booking.save()

            # Send Notification to the provider
            n_paid = Notification.objects.create(
                user=booking.provider_service.provider.user,
                title="Payment Received",
                message=f"{request.user.first_name} has paid ₹{booking.provider_service.price} via {payment_method.upper()} for Booking #BK-{booking.id}.",
                link="/provider-dashboard"
            )
            broadcast_notification(n_paid)

        serializer = BookingSerializer(booking)
        return Response(serializer.data)

class MessageClearAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, booking_id, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            raise ValidationError("Booking does not exist.")

        # Ensure user is part of the booking
        user = request.user
        if user.is_customer and booking.customer != user.customer_profile:
            raise ValidationError("You are not part of this booking.")
        elif user.is_provider and booking.provider_service.provider != user.provider_profile:
            raise ValidationError("You are not part of this booking.")

        # Delete all messages for this booking
        Message.objects.filter(booking=booking).delete()
        
        return Response({"detail": "Conversation cleared successfully."})


class ProviderAvailabilityView(generics.GenericAPIView):
    """GET /services/availability/  — returns the logged-in provider's weekly slots.
       PUT /services/availability/  — bulk-replace all slots."""
    serializer_class = ProviderAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if not request.user.is_provider:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only providers can view availability.")
        slots = ProviderAvailability.objects.filter(provider=request.user.provider_profile)
        serializer = ProviderAvailabilitySerializer(slots, many=True)
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        if not request.user.is_provider:
            raise PermissionDenied("Only providers can update availability.")

        provider = request.user.provider_profile
        slots_data = request.data  # Expect a list of slot objects

        if not isinstance(slots_data, list):
            raise ValidationError("Expected a list of availability slot objects.")

        # Validate all slots first
        errors = []
        for i, slot in enumerate(slots_data):
            s = ProviderAvailabilitySerializer(data=slot)
            if not s.is_valid():
                errors.append({f"slot_{i}": s.errors})
        if errors:
            raise ValidationError(errors)

        # Delete existing and recreate
        ProviderAvailability.objects.filter(provider=provider).delete()
        created = []
        for slot in slots_data:
            obj = ProviderAvailability.objects.create(
                provider=provider,
                day_of_week=slot['day_of_week'],
                start_time=slot['start_time'],
                end_time=slot['end_time'],
                is_available=slot.get('is_available', True),
            )
            created.append(obj)

        return Response(ProviderAvailabilitySerializer(created, many=True).data)


class AvailableTimeSlotsView(APIView):
    """GET /services/available-slots/?provider_id=X&date=YYYY-MM-DD
    Returns a list of available 30-min start times for the given provider on that date.
    Already-accepted/pending bookings are excluded."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from datetime import datetime, timedelta, date as date_type
        from rest_framework.exceptions import ValidationError
        from accounts.models import ProviderProfile

        provider_id = request.query_params.get('provider_id')
        date_str = request.query_params.get('date')

        if not provider_id or not date_str:
            raise ValidationError("provider_id and date are required query parameters.")

        try:
            provider = ProviderProfile.objects.get(pk=provider_id)
        except ProviderProfile.DoesNotExist:
            raise ValidationError("Provider not found.")

        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValidationError("Invalid date format. Use YYYY-MM-DD.")

        # 0=Mon, 6=Sun  (Python weekday() convention matches our model)
        day_of_week = query_date.weekday()

        # Find the provider's availability slot for this day
        try:
            slot = ProviderAvailability.objects.get(
                provider=provider,
                day_of_week=day_of_week,
                is_available=True
            )
        except ProviderAvailability.DoesNotExist:
            # Provider is not available on this day
            return Response({'available_slots': [], 'reason': 'Provider not available on this day.'})

        # Build all 30-min slots between start and end time
        all_slots = []
        current = datetime.combine(query_date, slot.start_time)
        end_dt = datetime.combine(query_date, slot.end_time)
        while current < end_dt:
            all_slots.append(current.strftime('%H:%M'))
            current += timedelta(minutes=30)

        # Find already-booked times on this date for this provider
        from django.utils import timezone
        booked_datetimes = Booking.objects.filter(
            provider_service__provider=provider,
            booking_date__date=query_date,
            status__in=['pending', 'accepted']
        ).values_list('booking_date', flat=True)

        booked_times = set()
        for bdt in booked_datetimes:
            # Convert to local time
            local_dt = timezone.localtime(bdt)
            booked_times.add(local_dt.strftime('%H:%M'))

        available_slots = [s for s in all_slots if s not in booked_times]

        return Response({
            'available_slots': available_slots,
            'booked_slots': list(booked_times),
            'day': query_date.strftime('%A'),
            'start_time': slot.start_time.strftime('%H:%M'),
            'end_time': slot.end_time.strftime('%H:%M'),
        })

class ProviderAnalyticsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_provider:
            return Response({"detail": "Only providers can access analytics."}, status=status.HTTP_403_FORBIDDEN)

        provider = request.user.provider_profile
        bookings = Booking.objects.filter(provider_service__provider=provider)

        total_earnings = sum(b.provider_service.price for b in bookings.filter(status='completed'))
        total_completed = bookings.filter(status='completed').count()
        total_pending = bookings.filter(status='pending').count()
        total_accepted = bookings.filter(status='accepted').count()
        total_cancelled = bookings.filter(status='cancelled').count()

        # Monthly breakdown
        from django.db.models.functions import TruncMonth
        from django.db.models import Sum, Count

        monthly_qs = (
            bookings.filter(status='completed')
            .annotate(month=TruncMonth('booking_date'))
            .values('month')
            .annotate(amount=Sum('provider_service__price'), count=Count('id'))
            .order_by('month')
        )

        monthly_data = [
            {
                "month": item['month'].strftime("%b %Y") if item['month'] else "Unknown",
                "amount": float(item['amount'] or 0),
                "count": item['count']
            }
            for item in monthly_qs
        ]

        # Category breakdown
        category_qs = (
            bookings.filter(status='completed')
            .values('provider_service__service__category__name')
            .annotate(amount=Sum('provider_service__price'), count=Count('id'))
            .order_by('-amount')
        )

        category_data = [
            {
                "category": item['provider_service__service__category__name'] or "General",
                "amount": float(item['amount'] or 0),
                "count": item['count']
            }
            for item in category_qs
        ]

        return Response({
            "total_earnings": float(total_earnings),
            "status_counts": {
                "completed": total_completed,
                "pending": total_pending,
                "accepted": total_accepted,
                "cancelled": total_cancelled,
            },
            "monthly_earnings": monthly_data,
            "category_earnings": category_data,
        })
