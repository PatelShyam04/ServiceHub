from django.urls import path
from .views import (
    CategoryListView, ProviderServiceListCreateView, ProviderServiceDestroyView, 
    ProviderSearchAPIView, BookingListCreateView, BookingStatusUpdateView, BookingPayAPIView,
    ReviewCreateView, ProviderReviewListView, MessageListCreateView, MessageDeleteAPIView,
    MessageClearAPIView, NotificationListAPIView, NotificationMarkReadAPIView, 
    NotificationDeleteAPIView, NotificationClearAllAPIView,
    ProviderAvailabilityView, AvailableTimeSlotsView, ProviderAnalyticsAPIView
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category_list'),
    path('provider/services/', ProviderServiceListCreateView.as_view(), name='provider_services'),
    path('provider/services/<int:pk>/', ProviderServiceDestroyView.as_view(), name='provider_service_detail'),
    path('provider/analytics/', ProviderAnalyticsAPIView.as_view(), name='provider_analytics'),
    path('search/', ProviderSearchAPIView.as_view(), name='search_providers'),
    path('bookings/', BookingListCreateView.as_view(), name='booking_list_create'),
    path('bookings/<int:pk>/status/', BookingStatusUpdateView.as_view(), name='booking_status_update'),
    path('bookings/<int:pk>/pay/', BookingPayAPIView.as_view(), name='booking_pay'),
    path('reviews/', ReviewCreateView.as_view(), name='review_create'),
    path('provider/reviews/', ProviderReviewListView.as_view(), name='provider_reviews'),
    path('messages/', MessageListCreateView.as_view(), name='messages'),
    path('messages/<int:pk>/delete/', MessageDeleteAPIView.as_view(), name='message-delete'),
    path('messages/clear/<int:booking_id>/', MessageClearAPIView.as_view(), name='message-clear-all'),
    path('notifications/', NotificationListAPIView.as_view(), name='notification-list'),
    path('notifications/clear/', NotificationClearAllAPIView.as_view(), name='notification-clear-all'),
    path('notifications/<int:pk>/read/', NotificationMarkReadAPIView.as_view(), name='notification-read'),
    path('notifications/<int:pk>/delete/', NotificationDeleteAPIView.as_view(), name='notification-delete'),
    # Availability
    path('availability/', ProviderAvailabilityView.as_view(), name='provider-availability'),
    path('available-slots/', AvailableTimeSlotsView.as_view(), name='available-slots'),
]
