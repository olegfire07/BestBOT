"""
Helper module for showing persistent menu keyboard.
"""
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from modern_bot.handlers.admin import is_admin
from modern_bot.config import IMGBB_KEY

def get_main_menu_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    """
    Returns the main menu keyboard based on user permissions.
    """
    base_url = os.getenv("WEB_APP_URL", "https://olegfire07.github.io/botbot/web_app/").strip()
    url_parts = urlsplit(base_url)
    query = dict(parse_qsl(url_parts.query, keep_blank_values=True))
    query.setdefault("v", os.getenv("WEB_APP_VERSION", "4.2"))
    if IMGBB_KEY:
        query["imgbb_key"] = IMGBB_KEY
    web_app_url = urlunsplit(
        (url_parts.scheme, url_parts.netloc, url_parts.path, urlencode(query), url_parts.fragment)
    )
    
    keyboard = [
        [KeyboardButton("📝 Создать заключение", web_app=WebAppInfo(url=web_app_url))],
        [KeyboardButton("ℹ️ Помощь")]
    ]
    
    if is_admin(user_id):
        keyboard.append([KeyboardButton("⚙️ Админ-панель")])
    
    return ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        input_field_placeholder="Выберите действие..."
    )

async def show_menu_after_action(update: Update, message_text: str = None):
    """
    Shows the main menu keyboard after an action.
    If message_text is provided, sends it. Otherwise just updates the keyboard.
    """
    user_id = update.effective_user.id
    keyboard = get_main_menu_keyboard(user_id)
    
    if message_text:
        await update.message.reply_text(
            message_text,
            reply_markup=keyboard,
            parse_mode="HTML"
        )
    else:
        # Just update keyboard without sending a message
        await update.message.reply_text(
            "👌",
            reply_markup=keyboard
        )
