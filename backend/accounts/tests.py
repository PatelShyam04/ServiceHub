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
            is_customer=True,
            is_email_verified=True
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
            is_provider=True,
            is_email_verified=True
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
            is_staff=True,
            is_email_verified=True
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

    def test_obtain_token_with_email(self):
        url = reverse('token_obtain_pair')
        data = {
            "username": "customer1@example.com",
            "password": "testpassword123"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_obtain_token_unverified_email(self):
        unverified_user = CustomUser.objects.create_user(
            username="unverified",
            email="unverified@example.com",
            password="testpassword123",
            is_email_verified=False
        )
        url = reverse('token_obtain_pair')
        data = {
            "username": "unverified",
            "password": "testpassword123"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("Your email is not verified yet", str(response.data))

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

    from unittest.mock import patch

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_new_user(self, mock_verify):
        mock_verify.return_value = {
            'email': 'googletest@example.com',
            'given_name': 'Google',
            'family_name': 'Tester'
        }
        url = reverse('google_login')
        response = self.client.post(url, {'token': 'valid_dummy_token', 'role': 'customer'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertTrue(CustomUser.objects.filter(email='googletest@example.com').exists())

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_existing_user(self, mock_verify):
        unverified_user = CustomUser.objects.create_user(
            username="unverified_google",
            email="unverified@example.com",
            is_active=False,
            is_email_verified=False,
            is_customer=True,   # must match the role sent in POST
            is_provider=False
        )
        mock_verify.return_value = {
            'email': 'unverified@example.com',
            'given_name': 'Unverified',
            'family_name': 'User'
        }
        url = reverse('google_login')
        response = self.client.post(url, {'token': 'valid_dummy_token', 'role': 'customer'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        unverified_user.refresh_from_db()
        self.assertTrue(unverified_user.is_active)
        self.assertTrue(unverified_user.is_email_verified)

    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_google_login_cross_role_blocked(self, mock_verify):
        """Existing Customer account should be blocked from logging in as Provider."""
        CustomUser.objects.create_user(
            username="cross_role_user",
            email="crossrole@example.com",
            is_active=True,
            is_email_verified=True,
            is_customer=True,
            is_provider=False
        )
        mock_verify.return_value = {
            'email': 'crossrole@example.com',
            'given_name': 'Cross',
            'family_name': 'Role'
        }
        url = reverse('google_login')
        # Customer account trying to sign in as provider — must be blocked
        response = self.client.post(url, {'token': 'valid_dummy_token', 'role': 'provider'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('detail', response.data)


