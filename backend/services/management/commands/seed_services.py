from django.core.management.base import BaseCommand
from services.models import Category, Service

class Command(BaseCommand):
    help = 'Seeds the database with standard Indian service categories'

    def handle(self, *args, **kwargs):
        categories_data = {
            'Home Services': [
                'Electrician',
                'Plumber',
                'Carpenter',
                'Painter',
                'AC Repair',
                'Appliance Repair',
                'Cleaning',
                'Pest Control',
                'RO Water Purifier Service'
            ],
            'Personal & Beauty': [
                'Salon for Women',
                'Salon for Men',
                'Spa at Home',
                'Makeup Artist',
                'Fitness Trainer',
                'Yoga Instructor'
            ],
            'Education & Learning': [
                'Home Tutor',
                'Music Teacher',
                'Dance Teacher',
                'Language Instructor'
            ],
            'IT & Digital': [
                'Web Developer',
                'Graphic Designer',
                'Computer Repair',
                'CCTV Installation'
            ],
            'Vehicle Services': [
                'Car Wash',
                'Bike Repair',
                'Car Mechanic'
            ]
        }

        self.stdout.write('Seeding service categories...')

        for cat_name, services in categories_data.items():
            category, created = Category.objects.get_or_create(
                name=cat_name,
                defaults={'description': f'{cat_name} category'}
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created category: {cat_name}'))
            else:
                self.stdout.write(f'Category already exists: {cat_name}')

            for svc_name in services:
                service, s_created = Service.objects.get_or_create(
                    category=category,
                    name=svc_name,
                    defaults={'description': f'Professional {svc_name} service'}
                )
                if s_created:
                    self.stdout.write(self.style.SUCCESS(f'  - Created service: {svc_name}'))
                else:
                    self.stdout.write(f'  - Service already exists: {svc_name}')

        self.stdout.write(self.style.SUCCESS('Successfully seeded all services!'))
