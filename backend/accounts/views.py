from rest_framework import generics, permissions
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import CustomUser, ProviderProfile, CustomerProfile, ProviderGalleryImage
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, ProviderProfileSerializer, CustomerProfileSerializer, ProviderGalleryImageSerializer, ChangePasswordSerializer

class CustomerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.customer_profile

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
        return self.request.user.provider_profile

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

