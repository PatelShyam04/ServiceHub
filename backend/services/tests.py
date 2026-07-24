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
            username="customer1", email="cust@test.com", password="password123", is_customer=True, first_name="Cust"
        )
        self.customer_profile = CustomerProfile.objects.create(user=self.customer_user, phone_number="1234")

        self.provider_user = CustomUser.objects.create_user(
            username="provider1", email="prov@test.com", password="password123", is_provider=True, first_name="Prov"
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
