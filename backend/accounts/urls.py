from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView, ProviderProfileView, CustomerProfileView, 
    ProviderGalleryUploadView, PublicProviderProfileView, ChangePasswordView,
    VerifyEmailAPIView, ResendVerificationCodeAPIView,
    ForgotPasswordRequestAPIView, ResetPasswordConfirmAPIView, GoogleLoginAPIView,
    SwitchRoleAPIView
)
from .admin_views import (
    AdminStatsAPIView, AdminProviderListAPIView, AdminProviderVerifyAPIView,
    AdminBookingListAPIView, AdminCategoryListCreateAPIView, AdminUserListAPIView,
    AdminUserToggleActiveAPIView, AdminCategoryDetailAPIView,
    AdminServiceListCreateAPIView, AdminServiceDetailAPIView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('google-login/', GoogleLoginAPIView.as_view(), name='google_login'),
    path('switch-role/', SwitchRoleAPIView.as_view(), name='switch_role'),
    path('verify-email/', VerifyEmailAPIView.as_view(), name='verify_email'),


    path('resend-verification/', ResendVerificationCodeAPIView.as_view(), name='resend_verification'),
    path('forgot-password/', ForgotPasswordRequestAPIView.as_view(), name='forgot_password'),
    path('reset-password/', ResetPasswordConfirmAPIView.as_view(), name='reset_password'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProviderProfileView.as_view(), name='provider_profile'),
    path('customer-profile/', CustomerProfileView.as_view(), name='customer_profile'),
    path('admin/stats/', AdminStatsAPIView.as_view(), name='admin_stats'),
    path('admin/providers/', AdminProviderListAPIView.as_view(), name='admin_providers'),
    path('admin/providers/<int:pk>/verify/', AdminProviderVerifyAPIView.as_view(), name='admin_verify_provider'),
    path('admin/bookings/', AdminBookingListAPIView.as_view(), name='admin_bookings'),
    path('admin/categories/', AdminCategoryListCreateAPIView.as_view(), name='admin_categories'),
    path('admin/categories/<int:pk>/', AdminCategoryDetailAPIView.as_view(), name='admin_category_detail'),
    path('admin/services/', AdminServiceListCreateAPIView.as_view(), name='admin_services'),
    path('admin/services/<int:pk>/', AdminServiceDetailAPIView.as_view(), name='admin_service_detail'),
    path('admin/users/', AdminUserListAPIView.as_view(), name='admin_users'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserToggleActiveAPIView.as_view(), name='admin_toggle_user_active'),
    path('gallery/', ProviderGalleryUploadView.as_view(), name='provider_gallery_upload'),
    path('gallery/<int:pk>/', ProviderGalleryUploadView.as_view(), name='provider_gallery_delete'),
    path('providers/<int:pk>/public/', PublicProviderProfileView.as_view(), name='public_provider_profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
]
