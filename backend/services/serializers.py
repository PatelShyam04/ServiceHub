from rest_framework import serializers
from .models import Category, Service, ProviderService, Booking, Review, Message, Notification, ProviderAvailability
from django.db.models import Avg


class ProviderAvailabilitySerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = ProviderAvailability
        fields = ('id', 'day_of_week', 'day_name', 'start_time', 'end_time', 'is_available')


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ('id', 'name', 'description')

class CategorySerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ('id', 'name', 'description', 'icon', 'services')

class ProviderServiceSerializer(serializers.ModelSerializer):
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), source='service', write_only=True
    )
    service_details = ServiceSerializer(source='service', read_only=True)
    category_name = serializers.CharField(source='service.category.name', read_only=True)
    
    # Provider details for customer view
    provider_id = serializers.IntegerField(source='provider.id', read_only=True)
    provider_first_name = serializers.CharField(source='provider.user.first_name', read_only=True)
    provider_last_name = serializers.CharField(source='provider.user.last_name', read_only=True)
    provider_bio = serializers.CharField(source='provider.bio', read_only=True)
    provider_city = serializers.CharField(source='provider.city', read_only=True)
    provider_latitude = serializers.FloatField(source='provider.latitude', read_only=True)
    provider_longitude = serializers.FloatField(source='provider.longitude', read_only=True)
    provider_verified = serializers.BooleanField(source='provider.is_verified', read_only=True)
    provider_profile_picture = serializers.ImageField(source='provider.profile_picture', read_only=True)
    provider_available_days = serializers.CharField(source='provider.available_days', read_only=True)
    provider_start_time = serializers.TimeField(source='provider.start_time', read_only=True)
    provider_end_time = serializers.TimeField(source='provider.end_time', read_only=True)
    provider_availability_slots = ProviderAvailabilitySerializer(
        source='provider.availability_slots', many=True, read_only=True
    )

    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = ProviderService
        fields = (
            'id', 'service_id', 'service_details', 'category_name', 'price',
            'provider_id', 'provider_first_name', 'provider_last_name', 'provider_bio', 'provider_city',
            'provider_latitude', 'provider_longitude',
            'provider_verified', 'provider_profile_picture',
            'provider_available_days', 'provider_start_time', 'provider_end_time',
            'provider_availability_slots',
            'average_rating', 'review_count'
        )
        # Suppress the auto-generated UniqueTogetherValidator for (provider, service).
        # 'provider' is not a writable serializer field — it is injected in perform_create.
        # Without this, DRF raises a validation error on every POST even for new services.
        # The DB unique_together constraint still enforces actual duplicate prevention.
        validators = []
        
    def get_average_rating(self, obj):
        reviews = Review.objects.filter(booking__provider_service__provider=obj.provider)
        avg = reviews.aggregate(Avg('rating'))['rating__avg']
        return round(avg, 1) if avg else 0.0

    def get_review_count(self, obj):
        return Review.objects.filter(booking__provider_service__provider=obj.provider).count()

class BookingSerializer(serializers.ModelSerializer):
    provider_service_id = serializers.PrimaryKeyRelatedField(
        queryset=ProviderService.objects.all(), source='provider_service', write_only=True
    )
    provider_service_details = ProviderServiceSerializer(source='provider_service', read_only=True)
    customer_name = serializers.CharField(source='customer.user.username', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)

    class Meta:
        model = Booking
        fields = (
            'id', 'provider_service_id', 'provider_service_details', 
            'customer_name', 'customer_phone', 'booking_date', 
            'address', 'problem_photo', 'problem_description',
            'status', 'payment_status', 'payment_method', 'created_at'
        )
        read_only_fields = ('status', 'payment_status', 'payment_method', 'created_at')
        
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['has_review'] = hasattr(instance, 'review')
        return rep

    def validate_booking_date(self, value):
        from django.utils import timezone
        if value < timezone.now():
            raise serializers.ValidationError("Booking date and time cannot be in the past.")
        return value

class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='booking.customer.user.first_name', read_only=True)
    service_name = serializers.CharField(source='booking.provider_service.service.name', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'booking', 'rating', 'comment', 'customer_name', 'service_name', 'created_at')
        read_only_fields = ('created_at',)

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.first_name', read_only=True)
    sender_is_provider = serializers.BooleanField(source='sender.is_provider', read_only=True)
    sender_is_customer = serializers.BooleanField(source='sender.is_customer', read_only=True)

    class Meta:
        model = Message
        fields = ('id', 'booking', 'sender', 'sender_name', 'sender_is_provider', 'sender_is_customer', 'content', 'timestamp', 'is_read')
        read_only_fields = ('sender', 'timestamp', 'is_read')

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'user', 'title', 'message', 'is_read', 'created_at', 'link')
        read_only_fields = ('user', 'created_at')
