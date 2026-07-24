import logging
import threading
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

logger = logging.getLogger(__name__)

def _async_send_mail(msg):
    try:
        msg.send(fail_silently=True)
    except Exception as e:
        logger.error(f"Async email dispatch error: {e}")

def build_base_html_template(title, badge_text, badge_bg, recipient_name, main_message, details_table_html="", cta_text="", cta_url=""):
    """
    Renders a modern, responsive HTML email template for ServiceHub.
    """
    cta_html = f'''
        <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="{cta_url}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                {cta_text}
            </a>
        </div>
    ''' if cta_text and cta_url else ""

    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 40px 10px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #3730a3 0%, #4f46e5 100%); padding: 32px 32px; text-align: center;">
                                <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); width: 44px; height: 44px; border-radius: 12px; line-height: 44px; color: #ffffff; font-weight: 800; font-size: 22px; margin-bottom: 8px;">S</div>
                                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">ServiceHub</h1>
                                <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;">Quality Local Services On-Demand</p>
                            </td>
                        </tr>

                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 36px 32px;">
                                
                                <!-- Status Badge -->
                                {f'<div style="margin-bottom: 20px;"><span style="background-color: {badge_bg}; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">{badge_text}</span></div>' if badge_text else ''}

                                <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Hello {recipient_name},</h2>
                                <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">{main_message}</p>

                                <!-- Details Table Card -->
                                {details_table_html}

                                <!-- Action Button -->
                                {cta_html}

                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
                                <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0; font-weight: 500;">
                                    ServiceHub Platform &bull; Customer & Provider Support
                                </p>
                                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                                    If you have any questions, reply to this email or contact support@servicehub.com
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    '''

def send_professional_email(recipient_email, recipient_name, subject, badge_text, badge_bg, main_message, details_dict=None, cta_text="", cta_url=""):
    if not recipient_email:
        return

    # Build Details Card HTML
    details_html = ""
    if details_dict:
        rows_html = ""
        for key, val in details_dict.items():
            rows_html += f'''
                <tr>
                    <td style="padding: 10px 14px; color: #64748b; font-size: 13px; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">{key}</td>
                    <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0;">{val}</td>
                </tr>
            '''
        details_html = f'''
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; border-collapse: separate; overflow: hidden;">
                {rows_html}
            </table>
        '''

    html_content = build_base_html_template(
        title=subject,
        badge_text=badge_text,
        badge_bg=badge_bg,
        recipient_name=recipient_name,
        main_message=main_message,
        details_table_html=details_html,
        cta_text=cta_text,
        cta_url=cta_url
    )

    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ServiceHub <no-reply@servicehub.com>')
        msg = EmailMultiAlternatives(subject, main_message, from_email, [recipient_email])
        msg.attach_alternative(html_content, "text/html")
        threading.Thread(target=_async_send_mail, args=(msg,), daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to prepare professional HTML email to {recipient_email}: {e}")

def send_otp_html_email(recipient_email, recipient_name, otp_code):
    subject = "ServiceHub — Verify Your Email Address"
    main_message = "Thank you for joining ServiceHub! Use the 6-digit verification code below to complete your registration."
    
    otp_card_html = f'''
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%); border: 2px dashed #818cf8; border-radius: 14px; padding: 24px; text-align: center; margin: 20px 0 24px 0;">
            <span style="display: block; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Verification Code</span>
            <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; color: #3730a3; letter-spacing: 8px; display: inline-block;">{otp_code}</span>
            <span style="display: block; color: #ef4444; font-size: 12px; font-weight: 600; margin-top: 10px;">⏱️ Expires in 2 minutes</span>
        </div>
    '''

    html_content = build_base_html_template(
        title=subject,
        badge_text="EMAIL VERIFICATION",
        badge_bg="#4f46e5",
        recipient_name=recipient_name,
        main_message=main_message,
        details_table_html=otp_card_html,
        cta_text="",
        cta_url=""
    )

    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ServiceHub <no-reply@servicehub.com>')
        msg = EmailMultiAlternatives(subject, f"Your 6-digit verification code is: {otp_code} (expires in 2 minutes).", from_email, [recipient_email])
        msg.attach_alternative(html_content, "text/html")
        threading.Thread(target=_async_send_mail, args=(msg,), daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to prepare OTP email to {recipient_email}: {e}")
