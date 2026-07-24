from django.db import models
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    is_customer = models.BooleanField(default=False)
    is_provider = models.BooleanField(default=False)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)
    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    email_verification_created_at = models.DateTimeField(null=True, blank=True)
    password_reset_code = models.CharField(max_length=6, blank=True, null=True)
    password_reset_created_at = models.DateTimeField(null=True, blank=True)

class CustomerProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='customer_profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    
    def __str__(self):
        return f"{self.user.username}'s Customer Profile"

CITY_COORDINATES = {
    'mumbai': (19.0760, 72.8777),
    'delhi': (28.6139, 77.2090),
    'bengaluru': (12.9716, 77.5946),
    'bangalore': (12.9716, 77.5946),
    'hyderabad': (17.3850, 78.4867),
    'ahmedabad': (23.0225, 72.5714),
    'chennai': (13.0827, 80.2707),
    'kolkata': (22.5726, 88.3639),
    'pune': (18.5204, 73.8567),
    'jaipur': (26.9124, 75.7873),
    'surat': (21.1702, 72.8311),
    'lucknow': (26.8467, 80.9462),
    'kanpur': (26.4499, 80.3319),
    'nagpur': (21.1458, 79.0882),
    'indore': (22.7196, 75.8577),
    'thane': (19.2183, 72.9781),
    'bhopal': (23.2599, 77.4126),
    'visakhapatnam': (17.6868, 83.2185),
    'vadodara': (22.3072, 73.1812),
    'ghaziabad': (28.6692, 77.4538),
    'ludhiana': (30.9010, 75.8573),
    'agra': (27.1767, 78.0081),
    'nashik': (19.9975, 73.7898),
    'ranchi': (23.3441, 85.3096),
    'varanasi': (25.3176, 82.9739),
    'rajkot': (22.3039, 70.8022),
}

class ProviderProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='provider_profile')
    bio = models.TextField(blank=True, null=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.FloatField(blank=True, null=True, help_text="GPS Latitude")
    longitude = models.FloatField(blank=True, null=True, help_text="GPS Longitude")
    is_verified = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    available_days = models.CharField(max_length=200, default='Monday,Tuesday,Wednesday,Thursday,Friday')
    start_time = models.TimeField(default='09:00:00')
    end_time = models.TimeField(default='17:00:00')
    skills = models.TextField(blank=True, null=True)
    experience_years = models.PositiveIntegerField(default=0)
    
    def save(self, *args, **kwargs):
        if (self.latitude is None or self.longitude is None) and self.city:
            normalized_city = self.city.strip().lower()
            if normalized_city in CITY_COORDINATES:
                base_lat, base_lng = CITY_COORDINATES[normalized_city]
                offset = (((self.pk or 1) * 3) % 15) * 0.004
                self.latitude = base_lat + offset
                self.longitude = base_lng + offset
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username}'s Provider Profile"

class ProviderGalleryImage(models.Model):
    provider = models.ForeignKey(ProviderProfile, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='portfolio_pics/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Gallery Image for {self.provider.user.username}"
