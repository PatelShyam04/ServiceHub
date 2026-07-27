from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from accounts.models import CustomUser, CustomerProfile, ProviderProfile
from .models import Category, Service, ProviderService, Booking, Review, Message, Notification

class ServicesTests(APITestCase):

    def setUp(self):
        # Create users
        self.customer_user = CustomUser.objects.create_user(
            username="customer1", email="cust@test.com", password="password123", is_customer=True, first_name="Cust", is_email_verified=True
        )
        self.customer_profile = CustomerProfile.objects.create(user=self.customer_user, phone_number="1234")

        self.provider_user = CustomUser.objects.create_user(
            username="provider1", email="prov@test.com", password="password123", is_provider=True, first_name="Prov", is_email_verified=True
        )
        self.provider_profile = ProviderProfile.objects.create(user=self.provider_user, phone_number="5678", city="Mumbai")

        # Create Category and Service
        self.category = Category.objects.create(name="Cleaning", description="Cleaning services", icon="cleaning-icon")
        self.service = Service.objects.create(category=self.category, name="Deep Cleaning", description="Deep cleaning of house")

        # Create ProviderService
        self.provider_service = ProviderService.objects.create(
            provider=self.provider_profile,
            service=self.service,
            price=1500.00
        )

        # Create Booking
        self.booking = Booking.objects.create(
            customer=self.customer_profile,
            provider_service=self.provider_service,
            booking_date=timezone.now(),
            address="123 Street, Mumbai",
            status="pending",
            payment_status="unpaid"
        )

    def test_category_list(self):
        url = reverse('category_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Cleaning")

    def test_provider_service_create(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('provider_services')
        
        # Create another service
        other_service = Service.objects.create(category=self.category, name="Sofa Cleaning", description="Sofa cleaning service")
        
        data = {
            "service_id": other_service.id,
            "price": 800.00
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProviderService.objects.filter(provider=self.provider_profile).count(), 2)

    def test_provider_service_list(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('provider_services')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_provider_search(self):
        url = reverse('search_providers')
        response = self.client.get(url, {'service_id': self.service.id, 'location': 'Mumbai'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(float(response.data[0]['price']), 1500.00)

    def test_create_booking_customer(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('booking_list_create')
        future_date = (timezone.now() + timezone.timedelta(days=2)).isoformat()
        data = {
            "provider_service_id": self.provider_service.id,
            "booking_date": future_date,
            "address": "456 Main St, Mumbai"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.filter(customer=self.customer_profile).count(), 2)
        
        # Verify notification created for provider
        self.assertEqual(Notification.objects.filter(user=self.provider_user, title="New Job Request").count(), 1)

    def test_create_booking_provider_denied(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('booking_list_create')
        future_date = (timezone.now() + timezone.timedelta(days=2)).isoformat()
        data = {
            "provider_service_id": self.provider_service.id,
            "booking_date": future_date,
            "address": "456 Main St, Mumbai"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_booking_status_provider(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('booking_status_update', kwargs={'pk': self.booking.pk})
        data = {
            "status": "accepted"
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, "accepted")

        # Verify notification created for customer
        self.assertEqual(Notification.objects.filter(user=self.customer_user, title="Booking Accepted").count(), 1)

    def test_booking_payment(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('booking_pay', kwargs={'pk': self.booking.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.payment_status, "paid")

        # Verify notification created for provider
        self.assertEqual(Notification.objects.filter(user=self.provider_user, title="Payment Received").count(), 1)

    def test_create_review(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('review_create')
        
        # Complete the booking to allow review
        self.booking.status = 'completed'
        self.booking.save()
        
        data = {
            "booking": self.booking.id,
            "rating": 5,
            "comment": "Excellent service!"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Review.objects.count(), 1)

    def test_messages(self):
        # Create a message
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('messages')
        data = {
            "booking": self.booking.id,
            "content": "Hello, when will you arrive?"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)

        # List messages
        response = self.client.get(url, {'booking_id': self.booking.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_notifications(self):
        self.client.force_authenticate(user=self.customer_user)
        Notification.objects.create(
            user=self.customer_user,
            title="Test Notification",
            message="This is a test notification."
        )

        url = reverse('notification-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # Clear notifications
        clear_url = reverse('notification-clear-all')
        response = self.client.delete(clear_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.customer_user).count(), 0)

    def test_available_time_slots_and_double_booking_prevention(self):
        from .models import ProviderAvailability
        # Create availability slot for provider on Monday (0)
        ProviderAvailability.objects.create(
            provider=self.provider_profile,
            day_of_week=0,
            start_time="09:00:00",
            end_time="17:00:00",
            is_available=True
        )

        from datetime import datetime, time
        now_local = timezone.localtime()
        days_ahead = (0 - now_local.weekday()) % 7
        if days_ahead <= 0:
            days_ahead += 7
        future_monday_date = (now_local + timezone.timedelta(days=days_ahead)).date()
        target_date_str = future_monday_date.strftime('%Y-%m-%d')
        local_bdt = timezone.make_aware(datetime.combine(future_monday_date, time(9, 0)))

        # Test GET available slots on a Monday date
        url = reverse('available-slots')
        response = self.client.get(url, {'provider_id': self.provider_profile.id, 'date': target_date_str})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('slots', response.data)
        self.assertEqual(len(response.data['slots']), 8) # 9 AM to 5 PM = 8 slots of 1 hr
        self.assertEqual(response.data['slots'][0]['label'], '09:00 AM - 10:00 AM')

        # Create a customer 2
        cust2 = CustomUser.objects.create_user(username="customer2", email="cust2@test.com", password="password123", is_customer=True)
        cust2_profile = CustomerProfile.objects.create(user=cust2, phone_number="9999")

        # Book 09:00 AM slot for provider on target_date_str
        self.client.force_authenticate(user=self.customer_user)
        booking_url = reverse('booking_list_create')
        data = {
            "provider_service_id": self.provider_service.id,
            "booking_date": local_bdt.isoformat(),
            "address": "789 Park Rd, Mumbai"
        }
        res1 = self.client.post(booking_url, data, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Re-fetch available slots and check 09:00 AM is now marked as booked
        response_after = self.client.get(url, {'provider_id': self.provider_profile.id, 'date': target_date_str})
        self.assertTrue(response_after.data['slots'][0]['is_booked'])

        # Attempt double-booking by customer 2 for the exact same slot
        self.client.force_authenticate(user=cust2)
        res2 = self.client.post(booking_url, data, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("This time slot has already been booked", str(res2.data))

        # Test past time slot booking rejection
        past_bdt = timezone.now() - timezone.timedelta(hours=3)
        past_data = {
            "provider_service_id": self.provider_service.id,
            "booking_date": past_bdt.isoformat(),
            "address": "Past St, Mumbai"
        }
        res_past = self.client.post(booking_url, past_data, format='json')
        self.assertEqual(res_past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Booking date and time cannot be in the past", str(res_past.data))
