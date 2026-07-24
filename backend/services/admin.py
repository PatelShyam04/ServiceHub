from django.contrib import admin
from .models import Category, Service

class ServiceInline(admin.TabularInline):
    model = Service
    extra = 1

class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    inlines = [ServiceInline]

class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'category']
    list_filter = ['category']

admin.site.register(Category, CategoryAdmin)
admin.site.register(Service, ServiceAdmin)
