from rest_framework.views import APIView
from rest_framework import generics, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import CustomUser, CustomerProfile, ProviderProfile
from services.models import Booking, Category, Service
from services.serializers import BookingSerializer, CategorySerializer, ServiceSerializer
from .serializers import ProviderProfileSerializer

class IsSuperUserOrStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)

class AdminStatsAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def get(self, request):
        total_users = CustomUser.objects.count()
        total_providers = ProviderProfile.objects.count()
        total_customers = CustomerProfile.objects.count()
        total_bookings = Booking.objects.count()
        
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncMonth
        from datetime import timedelta
        from django.utils import timezone
        
        # Financial aggregations
        completed_bookings = Booking.objects.filter(status='completed')
        total_revenue_val = completed_bookings.aggregate(Sum('provider_service__price'))['provider_service__price__sum'] or 0
        total_revenue = float(total_revenue_val)
        platform_commission = round(total_revenue * 0.10, 2)  # 10% platform share

        # Booking Status Breakdown
        status_counts = {
            'completed': Booking.objects.filter(status='completed').count(),
            'pending': Booking.objects.filter(status='pending').count(),
            'accepted': Booking.objects.filter(status='accepted').count(),
            'cancelled': Booking.objects.filter(status='cancelled').count(),
        }

        # Top Categories Leaderboard
        category_qs = (
            Booking.objects.filter(status='completed')
            .values('provider_service__service__category__name')
            .annotate(amount=Sum('provider_service__price'), count=Count('id'))
            .order_by('-amount')[:5]
        )
        top_categories = [
            {
                'name': cat['provider_service__service__category__name'] or 'General',
                'revenue': float(cat['amount'] or 0),
                'count': cat['count']
            }
            for cat in category_qs
        ]

        six_months_ago = timezone.now() - timedelta(days=180)
        recent_bookings = Booking.objects.filter(created_at__gte=six_months_ago, status='completed')
        
        monthly_stats = recent_bookings.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            booking_count=Count('id'),
            revenue=Sum('provider_service__price')
        ).order_by('month')

        monthly_data = []
        for stat in monthly_stats:
            if stat['month']:
                rev = float(stat['revenue']) if stat['revenue'] else 0
                monthly_data.append({
                    'month': stat['month'].strftime('%b %Y'),
                    'bookings': stat['booking_count'],
                    'revenue': rev,
                    'commission': round(rev * 0.10, 2)
                })

        return Response({
            'total_users': total_users,
            'total_providers': total_providers,
            'total_customers': total_customers,
            'total_bookings': total_bookings,
            'total_revenue': total_revenue,
            'platform_commission': platform_commission,
            'status_counts': status_counts,
            'top_categories': top_categories,
            'monthly_data': monthly_data
        })

class AdminProviderListAPIView(generics.ListAPIView):
    queryset = ProviderProfile.objects.all().order_by('-id')
    serializer_class = ProviderProfileSerializer
    permission_classes = [IsSuperUserOrStaff]

class AdminProviderVerifyAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def patch(self, request, pk):
        provider = get_object_or_404(ProviderProfile, pk=pk)
        provider.is_verified = True
        provider.save()
        return Response({'status': 'verified'})

class AdminBookingListAPIView(generics.ListAPIView):
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer
    permission_classes = [IsSuperUserOrStaff]

class AdminCategoryListCreateAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def get(self, request):
        categories = Category.objects.all()
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

class AdminCategoryDetailAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def delete(self, request, pk):
        category = get_object_or_404(Category, pk=pk)
        category.delete()
        return Response({'status': 'deleted'}, status=200)

class AdminServiceListCreateAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def post(self, request):
        category_id = request.data.get('category') or request.data.get('category_id')
        name = request.data.get('name')
        description = request.data.get('description', '')

        if not category_id or not name:
            return Response({'detail': 'Category ID and service name are required.'}, status=400)

        category = get_object_or_404(Category, pk=category_id)
        service = Service.objects.create(
            category=category,
            name=name.strip(),
            description=description.strip()
        )
        return Response(ServiceSerializer(service).data, status=201)

class AdminServiceDetailAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def delete(self, request, pk):
        service = get_object_or_404(Service, pk=pk)
        service.delete()
        return Response({'status': 'deleted'}, status=200)

class AdminUserListAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def get(self, request):
        users = CustomUser.objects.all().order_by('-date_joined')
        data = []
        for u in users:
            role = 'Admin' if u.is_staff or u.is_superuser else ('Provider' if u.is_provider else 'Customer')
            data.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'role': role,
                'is_active': u.is_active,
                'is_email_verified': u.is_email_verified,
                'date_joined': u.date_joined
            })
        return Response(data)

class AdminUserToggleActiveAPIView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def patch(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        if user == request.user:
            return Response({'detail': 'You cannot block your own admin account.'}, status=400)
        user.is_active = not user.is_active
        user.save()
        return Response({
            'is_active': user.is_active, 
            'message': f'Account @{user.username} has been {"unblocked" if user.is_active else "blocked"}.'
        })
