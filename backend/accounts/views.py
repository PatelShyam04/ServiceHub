from rest_framework import generics, permissions
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import CustomUser, ProviderProfile, CustomerProfile, ProviderGalleryImage
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, ProviderProfileSerializer, CustomerProfileSerializer, ProviderGalleryImageSerializer, ChangePasswordSerializer

class CustomerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        if not user.is_customer:
            user.is_customer = True
            user.save(update_fields=['is_customer'])
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        return profile

class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class ProviderProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProviderProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        if not user.is_provider:
            user.is_provider = True
            user.save(update_fields=['is_provider'])
        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        return profile

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import ProviderGalleryImage
from .serializers import ProviderGalleryImageSerializer
from services.models import ProviderService, Review
from services.serializers import ProviderServiceSerializer, ReviewSerializer

class ProviderGalleryUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        provider = request.user.provider_profile
        serializer = ProviderGalleryImageSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(provider=provider)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        provider = request.user.provider_profile
        image = get_object_or_404(ProviderGalleryImage, pk=pk, provider=provider)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class PublicProviderProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        provider = get_object_or_404(ProviderProfile, pk=pk)
        provider_data = ProviderProfileSerializer(provider, context={'request': request}).data
        
        # Get services
        services = ProviderService.objects.filter(provider=provider)
        provider_data['services'] = ProviderServiceSerializer(services, many=True, context={'request': request}).data
        
        # Get reviews
        reviews = Review.objects.filter(booking__provider_service__provider=provider).order_by('-created_at')
        provider_data['reviews'] = ReviewSerializer(reviews, many=True).data
        
        return Response(provider_data)

class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            if not user.check_password(serializer.data.get("old_password")):
                return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.data.get("new_password"))
            user.save()
            return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyEmailAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.utils import timezone

        username = request.data.get('username')
        code = str(request.data.get('code', '')).strip()

        if not username or not code:
            return Response({"detail": "Username and 6-digit verification code are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified and user.is_active:
            return Response({"message": "Email is already verified."}, status=status.HTTP_200_OK)

        # Check OTP expiration (120 seconds / 2 minutes)
        if user.email_verification_created_at:
            elapsed_seconds = (timezone.now() - user.email_verification_created_at).total_seconds()
            if elapsed_seconds > 120:
                return Response({"detail": "Verification code has expired (valid for 2 minutes). Please click 'Resend Code'."}, status=status.HTTP_400_BAD_REQUEST)

        if user.email_verification_code and user.email_verification_code.strip() == code:
            user.is_active = True
            user.is_email_verified = True
            user.email_verification_code = None
            user.save()
            return Response({"message": "Email verified successfully! Your account is now active."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid verification code. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

class ResendVerificationCodeAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import random
        from django.utils import timezone
        from django.core.mail import send_mail
        from django.conf import settings

        username = request.data.get('username')
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified and user.is_active:
            return Response({"message": "Email is already verified."}, status=status.HTTP_200_OK)

        new_code = f"{random.randint(100000, 999999)}"
        user.email_verification_code = new_code
        user.email_verification_created_at = timezone.now()
        user.save()

        try:
            from services.email_utils import send_otp_html_email
            send_otp_html_email(user.email, user.first_name or user.username, new_code)
        except Exception as e:
            print("Failed to resend verification email:", e)

        return Response({"message": "A new 6-digit verification code has been sent to your email (expires in 2 minutes)."}, status=status.HTTP_200_OK)

class ForgotPasswordRequestAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import random
        from django.utils import timezone
        from services.email_utils import send_professional_email

        query = request.data.get('username_or_email', '').strip()
        if not query:
            return Response({"detail": "Username or email address is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.filter(username=query).first() or CustomUser.objects.filter(email=query).first()
        if not user:
            return Response({"detail": "No account found associated with that username or email."}, status=status.HTTP_404_NOT_FOUND)

        if not user.email:
            return Response({"detail": "This account does not have a registered email address. Contact support."}, status=status.HTTP_400_BAD_REQUEST)

        reset_code = f"{random.randint(100000, 999999)}"
        user.password_reset_code = reset_code
        user.password_reset_created_at = timezone.now()
        user.save()

        # Send HTML reset email
        main_msg = f"You requested a password reset for your ServiceHub account (@{user.username}). Use the 6-digit verification code below to set a new password."
        details = {
            "Reset OTP Code": f"🔑 {reset_code}",
            "Expiration": "⏱️ Valid for 5 minutes",
            "Account": user.username
        }
        send_professional_email(
            recipient_email=user.email,
            recipient_name=user.first_name or user.username,
            subject="ServiceHub — Password Reset Request",
            badge_text="PASSWORD RESET",
            badge_bg="#e11d48",
            main_message=main_msg,
            details_dict=details
        )

        return Response({
            "message": f"A 6-digit password reset code has been sent to your registered email address.",
            "username": user.username
        }, status=status.HTTP_200_OK)

class ResetPasswordConfirmAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.utils import timezone

        username = request.data.get('username', '').strip()
        code = str(request.data.get('code', '')).strip()
        new_password = request.data.get('new_password', '')

        if not username or not code or not new_password:
            return Response({"detail": "Username, OTP code, and new password are all required."}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({"detail": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check OTP expiration (5 minutes / 300 seconds)
        if user.password_reset_created_at:
            elapsed_seconds = (timezone.now() - user.password_reset_created_at).total_seconds()
            if elapsed_seconds > 300:
                return Response({"detail": "Password reset code has expired (valid for 5 minutes). Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)

        if user.password_reset_code and user.password_reset_code.strip() == code:
            user.set_password(new_password)
            user.password_reset_code = None
            user.save()
            return Response({"message": "Password reset successfully! You can now log in with your new password."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Invalid password reset code. Please check and try again."}, status=status.HTTP_400_BAD_REQUEST)

class GoogleLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import requests
        import logging
        from .serializers import CustomTokenObtainPairSerializer

        logger = logging.getLogger(__name__)

        # Support both access_token (useGoogleLogin implicit flow) and credential/token (ID token)
        access_token = request.data.get('access_token')
        id_token_str = request.data.get('token') or request.data.get('credential')
        role = request.data.get('role', 'customer')

        if not access_token and not id_token_str:
            return Response({"detail": "Google token is required."}, status=status.HTTP_400_BAD_REQUEST)

        id_info = None
        verify_error = None

        # --- Path A: access_token (implicit flow from useGoogleLogin) ---
        if access_token:
            try:
                resp = requests.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {access_token}'},
                    timeout=10
                )
                if resp.status_code == 200:
                    id_info = resp.json()
                else:
                    verify_error = f"Google userinfo status {resp.status_code}: {resp.text}"
                    logger.warning(f"Google userinfo failed: {verify_error}")
            except Exception as e:
                verify_error = f"HTTP request to Google userinfo failed: {e}"
                logger.warning(verify_error)

        # --- Path B: ID token (credential from GoogleLogin component) ---
        if not id_info and id_token_str:
            # 1. Try google-auth library if available
            try:
                from google.oauth2 import id_token as google_id_token
                from google.auth.transport import requests as google_requests
                id_info = google_id_token.verify_oauth2_token(id_token_str, google_requests.Request(), clock_skew_in_seconds=10)
            except ImportError:
                logger.info("google-auth not installed; falling back to tokeninfo endpoint.")
            except Exception as e:
                verify_error = str(e)
                logger.warning(f"id_token.verify_oauth2_token failed: {e}")

            # 2. Fallback: tokeninfo endpoint
            if not id_info:
                try:
                    resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}', timeout=10)
                    if resp.status_code == 200:
                        id_info = resp.json()
                    else:
                        verify_error = f"Google tokeninfo status {resp.status_code}: {resp.text}"
                except Exception as e:
                    verify_error = f"HTTP request to Google tokeninfo failed: {e}"

        if not id_info or not id_info.get('email'):
            return Response(
                {"detail": f"Invalid Google token. Details: {verify_error or 'Verification failed'}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            email = id_info.get('email')
            first_name = id_info.get('given_name', '')
            last_name = id_info.get('family_name', '')

            user = CustomUser.objects.filter(email__iexact=email).first()

            is_new_user = not bool(user)

            if not user:
                base_username = email.split('@')[0]
                username = base_username
                counter = 1
                while CustomUser.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                is_customer = (role != 'provider')
                is_provider = (role == 'provider')

                is_provider = (role == 'provider')
                is_customer = (role != 'provider')

                user = CustomUser.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    is_customer=is_customer,
                    is_provider=is_provider,
                    is_active=True,
                    is_email_verified=True
                )
                if is_provider:
                    ProviderProfile.objects.get_or_create(user=user)
                else:
                    CustomerProfile.objects.get_or_create(user=user)
            else:
                # Existing user — enforce their registered role, do not allow switching
                if role == 'provider' and not user.is_provider:
                    return Response({
                        "detail": f"This Google account is already registered as a Customer. Please sign in as Customer, or create a new account with a different email for a Service Professional account."
                    }, status=status.HTTP_403_FORBIDDEN)

                if role == 'customer' and not user.is_customer:
                    return Response({
                        "detail": f"This Google account is already registered as a Service Professional. Please sign in as Service Professional, or create a new account with a different email for a Customer account."
                    }, status=status.HTTP_403_FORBIDDEN)

                user.is_active = True
                user.is_email_verified = True
                user.save()
                # Ensure their profile exists
                if user.is_provider:
                    ProviderProfile.objects.get_or_create(user=user)
                else:
                    CustomerProfile.objects.get_or_create(user=user)


            actual_role = 'provider' if role == 'provider' else ('provider' if user.is_provider and not user.is_customer else 'customer')
            role_mismatch = False

            refresh = CustomTokenObtainPairSerializer.get_token(user)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'username': user.username,
                'email': user.email,
                'is_customer': user.is_customer,
                'is_provider': user.is_provider,
                'is_staff': user.is_staff,
                'is_new_user': is_new_user,
                'requested_role': role,
                'actual_role': actual_role,
                'role_mismatch': role_mismatch,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in Google login: {e}", exc_info=True)
            return Response({"detail": f"Account processing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SwitchRoleAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .serializers import CustomTokenObtainPairSerializer

        target_role = request.data.get('target_role', '').lower()
        if target_role not in ['customer', 'provider']:
            return Response({"detail": "Invalid target role. Must be 'customer' or 'provider'."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if target_role == 'provider':
            user.is_provider = True
            user.is_customer = False
            user.save()
            ProviderProfile.objects.get_or_create(user=user)
        else:
            user.is_customer = True
            user.is_provider = False
            user.save()
            CustomerProfile.objects.get_or_create(user=user)

        refresh = CustomTokenObtainPairSerializer.get_token(user)

        return Response({
            'message': f"Switched role to {target_role} successfully.",
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'is_customer': user.is_customer,
            'is_provider': user.is_provider,
            'active_role': target_role
        }, status=status.HTTP_200_OK)





