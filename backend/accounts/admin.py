from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, CustomerProfile, ProviderProfile

class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ['username', 'email', 'is_customer', 'is_provider', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('Role & Profile Info', {'fields': ('is_customer', 'is_provider', 'gender', 'birth_date')}),
    )

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(CustomerProfile)
admin.site.register(ProviderProfile)
