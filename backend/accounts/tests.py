from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import CustomUser, CustomerProfile, ProviderProfile

class AccountsTests(APITestCase):

    def setUp(self):
        # Create a customer user
        self.customer_user = CustomUser.objects.create_user(
            username="customer1",
            email="customer1@example.com",
            password="testpassword123",
            is_customer=True
        )
        self.customer_profile = CustomerProfile.objects.create(
            user=self.customer_user,
            phone_number="1234567890"
        )

        # Create a provider user
        self.provider_user = CustomUser.objects.create_user(
            username="provider1",
            email="provider1@example.com",
            password="testpassword123",
            is_provider=True
        )
        self.provider_profile = ProviderProfile.objects.create(
            user=self.provider_user,
            phone_number="0987654321",
            city="New York",
            skills="Plumbing"
        )

        # Create an admin user
        self.admin_user = CustomUser.objects.create_superuser(
            username="admin1",
            email="admin1@example.com",
            password="adminpassword123",
            is_staff=True
        )

    def test_register_customer(self):
        url = reverse('register')
        data = {
            "username": "newcustomer",
            "email": "newcustomer@example.com",
            "password": "newpassword123",
            "first_name": "New",
            "last_name": "Customer",
            "role": "customer",
            "phone_number": "1112223333",
            "gender": "M",
            "birth_date": "1995-05-15"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomUser.objects.filter(username="newcustomer").count(), 1)
        self.assertEqual(CustomerProfile.objects.filter(phone_number="1112223333").count(), 1)

    def test_register_provider(self):
        url = reverse('register')
        data = {
            "username": "newprovider",
            "email": "newprovider@example.com",
            "password": "newpassword123",
            "first_name": "New",
            "last_name": "Provider",
            "role": "provider",
            "phone_number": "4445556666",
            "gender": "F",
            "birth_date": "1990-10-10"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomUser.objects.filter(username="newprovider").count(), 1)
        self.assertEqual(ProviderProfile.objects.filter(phone_number="4445556666").count(), 1)

    def test_obtain_token(self):
        url = reverse('token_obtain_pair')
        data = {
            "username": "customer1",
            "password": "testpassword123"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_get_customer_profile(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('customer_profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], "1234567890")

    def test_update_customer_profile(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('customer_profile')
        data = {
            "phone_number": "9999999999"
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CustomerProfile.objects.get(user=self.customer_user).phone_number, "9999999999")

    def test_get_provider_profile(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('provider_profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['city'], "New York")

    def test_update_provider_profile(self):
        self.client.force_authenticate(user=self.provider_user)
        url = reverse('provider_profile')
        data = {
            "city": "Los Angeles",
            "skills": "Electrical"
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(ProviderProfile.objects.get(user=self.provider_user).city, "Los Angeles")

    def test_admin_stats_unauthorized(self):
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('admin_stats')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_stats_authorized(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_stats')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_users'], 3)

    def test_admin_verify_provider(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_verify_provider', kwargs={'pk': self.provider_profile.pk})
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.provider_profile.refresh_from_db()
        self.assertTrue(self.provider_profile.is_verified)
