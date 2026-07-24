import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Booking, Message, Notification
from .serializers import MessageSerializer, NotificationSerializer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.booking_id = self.scope['url_route']['kwargs']['booking_id']
        self.room_group_name = f'chat_{self.booking_id}'
        self.user = self.scope.get('user', AnonymousUser())

        if self.user.is_anonymous:
            await self.close()
            return

        is_allowed = await self.check_booking_membership(self.user, self.booking_id)
        if not is_allowed:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            content = data.get('content', '').strip()
            if not content:
                return

            saved_msg = await self.save_message(self.user, self.booking_id, content)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': saved_msg
                }
            )
        except Exception as e:
            print("ChatConsumer error:", e)

    async def chat_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': message
        }))

    @database_sync_to_async
    def check_booking_membership(self, user, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
            if user.is_customer and hasattr(user, 'customer_profile'):
                return booking.customer == user.customer_profile
            if user.is_provider and hasattr(user, 'provider_profile'):
                return booking.provider_service.provider == user.provider_profile
            return False
        except Booking.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, user, booking_id, content):
        booking = Booking.objects.get(id=booking_id)
        msg = Message.objects.create(
            booking=booking,
            sender=user,
            content=content
        )
        return MessageSerializer(msg).data


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())
        if self.user.is_anonymous:
            await self.close()
            return

        self.room_group_name = f'user_notifications_{self.user.id}'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def notification_event(self, event):
        notification = event['notification']
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': notification
        }))
