from datetime import date
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import CustomUser, CustomerProfile, ProviderProfile, ProviderGalleryImage

class CustomerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = CustomerProfile
        fields = ('id', 'username', 'first_name', 'last_name', 'phone_number')

class ProviderGalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderGalleryImage
        fields = ('id', 'image', 'uploaded_at')

class ProviderProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    gallery_images = ProviderGalleryImageSerializer(many=True, read_only=True)

    class Meta:
        model = ProviderProfile
        fields = ('id', 'user_id', 'username', 'first_name', 'last_name', 'is_active', 'bio', 'phone_number', 'city', 'latitude', 'longitude', 'is_verified', 'profile_picture', 'available_days', 'start_time', 'end_time', 'skills', 'experience_years', 'gallery_images')
        read_only_fields = ('is_verified',)

class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(write_only=True)
    first_name = serializers.CharField(write_only=True, required=True)
    last_name = serializers.CharField(write_only=True, required=True)
    phone_number = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(write_only=True, required=True)
    gender = serializers.ChoiceField(choices=CustomUser.GENDER_CHOICES, write_only=True, required=True)
    birth_date = serializers.DateField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'password', 'role', 'first_name', 'last_name', 'phone_number', 'gender', 'birth_date')
        extra_kwargs = {
            'password': {'write_only': True},
            'username': {'validators': []},  # Handled in custom validate
            'email': {'validators': []},     # Handled in custom validate
        }

    def validate(self, data):
        role = data.get('role', 'customer')
        birth_date = data.get('birth_date')
        username = data.get('username')
        email = data.get('email')

        if role == 'provider' and birth_date:
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if age < 18:
                raise ValidationError({"birth_date": "Providers must be at least 18 years old."})

        # Check existing active/verified users for email
        if email:
            existing_email_user = CustomUser.objects.filter(email=email).first()
            if existing_email_user:
                if existing_email_user.is_email_verified or existing_email_user.is_active:
                    raise ValidationError({"email": "An account with this email address already exists."})
                else:
                    # Clean up old unverified attempt
                    existing_email_user.delete()

        # Check existing active/verified users for username
        if username:
            existing_username_user = CustomUser.objects.filter(username=username).first()
            if existing_username_user:
                if existing_username_user.is_email_verified or existing_username_user.is_active:
                    raise ValidationError({"username": "A user with that username already exists."})
                else:
                    # Clean up old unverified attempt
                    existing_username_user.delete()

        return data

    def create(self, validated_data):
        import random
        from django.utils import timezone
        from django.core.mail import send_mail
        from django.conf import settings

        role = validated_data.pop('role', 'customer')
        phone_number = validated_data.pop('phone_number')
        username = validated_data['username']
        email = validated_data['email']

        # Clean up any existing unverified inactive account with same username or email
        CustomUser.objects.filter(username=username, is_email_verified=False, is_active=False).delete()
        CustomUser.objects.filter(email=email, is_email_verified=False, is_active=False).delete()
        
        verification_code = f"{random.randint(100000, 999999)}"

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            gender=validated_data['gender'],
            birth_date=validated_data['birth_date'],
            is_active=False,  # Unactive until email OTP is verified
            is_email_verified=False,
            email_verification_code=verification_code,
            email_verification_created_at=timezone.now()
        )
        
        if role == 'provider':
            user.is_provider = True
            ProviderProfile.objects.create(user=user, phone_number=phone_number)
        else:
            user.is_customer = True
            CustomerProfile.objects.create(user=user, phone_number=phone_number)
            
        user.save()

        # Send professional OTP HTML verification email
        try:
            from services.email_utils import send_otp_html_email
            send_otp_html_email(user.email, user.first_name or user.username, verification_code)
        except Exception as e:
            print("Verification email dispatch failed:", e)

        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        from django.db.models import Q
        from rest_framework.exceptions import AuthenticationFailed

        identifier = attrs.get(self.username_field)
        password = attrs.get('password')

        if identifier:
            # Look up user by username or email
            user_obj = CustomUser.objects.filter(
                Q(username=identifier) | Q(email=identifier)
            ).first()

            if user_obj:
                # If matched by email, substitute actual username for SimpleJWT standard auth
                attrs[self.username_field] = user_obj.username

                if password:
                    if not user_obj.check_password(password):
                        raise AuthenticationFailed("Invalid password. Please check your credentials and try again.")
                    
                    if not user_obj.is_email_verified:
                        raise AuthenticationFailed({
                            "detail": "Your email is not verified yet. Please enter the verification OTP code sent to your email address.",
                            "code": "email_not_verified",
                            "username": user_obj.username
                        })

                    if not user_obj.is_active:
                        raise AuthenticationFailed(f"Your account (@{user_obj.username}) has been deactivated by platform administration. Please contact support.")
            else:
                raise AuthenticationFailed("No account found with this username or email address.")

        data = super().validate(attrs)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_customer'] = user.is_customer
        token['is_provider'] = user.is_provider
        token['is_staff'] = user.is_staff
        token['is_email_verified'] = user.is_email_verified
        return token
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
