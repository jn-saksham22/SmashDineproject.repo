from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import qrcode
import io
import base64
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Annotated
from typing import Any
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ['JWT_SECRET_KEY']
ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', 72))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="SmashDine Platform")
api_router = APIRouter(prefix="/api")

origins = [
    "https://smash-dineproject-repo.vercel.app",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://smash-dineproject-repo.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── MongoDB helpers ─────────────────────────────────────────────────────────

def to_str_id(doc: dict) -> dict:
    if doc and '_id' in doc:
        doc['id'] = str(doc.pop('_id'))
    return doc

# ── Auth utils ───────────────────────────────────────────────────────────────

def hash_password(pwd: str) -> str:
    return pwd_context.hash(pwd)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload['exp'] = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_owner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        owner_id = payload.get('owner_id')
        restaurant_id = payload.get('restaurant_id')
        if not owner_id or not restaurant_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {'owner_id': owner_id, 'restaurant_id': restaurant_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ── Helpers ──────────────────────────────────────────────────────────────────

def gen_order_id() -> str:
    chars = string.ascii_uppercase + string.digits
    return 'ORD-' + ''.join(random.choices(chars, k=4)) + '-' + ''.join(random.choices(chars, k=4))

def gen_coupon_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return 'SMASH-' + ''.join(random.choices(chars, k=4)) + '-' + ''.join(random.choices(chars, k=4))

def generate_qr_base64(url: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=4,
                       error_correction=qrcode.constants.ERROR_CORRECT_H)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1F2937", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

def calc_prep_time(items: list) -> int:
    if not items:
        return 5
    times = [i.get('prep_time_minutes', 8) * i.get('quantity', 1) for i in items]
    # First item full time, rest add 40%
    times_sorted = sorted(times, reverse=True)
    total = times_sorted[0] + sum(t * 0.4 for t in times_sorted[1:])
    return min(int(total), 40)

def calc_reward(total: float) -> dict:
    if total >= 1500:
        return {'type': 'combo', 'label': '10% Discount + 2 Free Drinks', 'discount_pct': 10, 'free_drinks': 2}
    elif total >= 700:
        return {'type': 'free_drinks', 'label': '2 Free Drinks on your next visit!', 'discount_pct': 0, 'free_drinks': 2}
    else:
        return {'type': 'discount', 'label': '10% Discount on next order', 'discount_pct': 10, 'free_drinks': 0}

SEED_CATEGORIES = [
    {'name': 'Fast Food', 'sort_order': 1},
    {'name': 'Shakes & Smoothies', 'sort_order': 2},
    {'name': 'Drinks & Beverages', 'sort_order': 3},
    {'name': 'Snacks & Starters', 'sort_order': 4},
    {'name': 'Desserts', 'sort_order': 5},
]

SEED_ITEMS = {
    'Fast Food': [
        {'name': 'Classic Beef Burger', 'description': 'Juicy beef patty with lettuce, tomato & special sauce', 'price': 249, 'image_url': 'https://images.unsplash.com/photo-1632898657999-ae6920976661?w=400&q=80', 'prep_time_minutes': 8, 'item_type': 'food'},
        {'name': 'Truffle Mushroom Burger', 'description': 'Gourmet mushroom patty with truffle aioli & arugula', 'price': 349, 'image_url': 'https://images.unsplash.com/photo-1632898657953-f41f81bfa892?w=400&q=80', 'prep_time_minutes': 10, 'item_type': 'food'},
        {'name': 'Double Smash Burger', 'description': 'Double smashed patties with melted cheddar & pickles', 'price': 399, 'image_url': 'https://images.unsplash.com/photo-1627378378955-a3f4e406c5de?w=400&q=80', 'prep_time_minutes': 10, 'item_type': 'food'},
        {'name': 'Crispy Chicken Sandwich', 'description': 'Fried chicken fillet with coleslaw & chipotle mayo', 'price': 299, 'image_url': 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80', 'prep_time_minutes': 9, 'item_type': 'food'},
        {'name': 'Loaded Cheese Fries', 'description': 'Crispy fries smothered in nacho cheese & jalapenos', 'price': 199, 'image_url': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80', 'prep_time_minutes': 7, 'item_type': 'food'},
    ],
    'Shakes & Smoothies': [
        {'name': 'Oreo Cookie Shake', 'description': 'Creamy vanilla soft serve blended with Oreo cookies', 'price': 199, 'image_url': 'https://images.unsplash.com/photo-1761637592257-3c5911ae5a3a?w=400&q=80', 'prep_time_minutes': 4, 'item_type': 'shake'},
        {'name': 'Chocolate Fudge Shake', 'description': 'Rich dark chocolate ice cream blended to perfection', 'price': 189, 'image_url': 'https://images.unsplash.com/photo-1761023612875-2561e18d8934?w=400&q=80', 'prep_time_minutes': 4, 'item_type': 'shake'},
        {'name': 'Mango Tango Shake', 'description': 'Fresh Alphonso mango blended with cream & honey', 'price': 189, 'image_url': 'https://images.unsplash.com/photo-1767114915915-4433437ac280?w=400&q=80', 'prep_time_minutes': 4, 'item_type': 'shake'},
        {'name': 'Classic Vanilla Shake', 'description': 'Premium vanilla bean ice cream shake with whipped cream', 'price': 169, 'image_url': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80', 'prep_time_minutes': 3, 'item_type': 'shake'},
    ],
    'Drinks & Beverages': [
        {'name': 'Fresh Lemon Soda', 'description': 'Zesty fresh lemon with sparkling water & mint', 'price': 89, 'image_url': 'https://images.unsplash.com/photo-1746785011440-aff1c8e0e559?w=400&q=80', 'prep_time_minutes': 2, 'item_type': 'drink'},
        {'name': 'Watermelon Cooler', 'description': 'Fresh watermelon juice with a hint of ginger', 'price': 129, 'image_url': 'https://images.unsplash.com/photo-1746785011420-504d56709419?w=400&q=80', 'prep_time_minutes': 2, 'item_type': 'drink'},
        {'name': 'Sparkling Orange Fizz', 'description': 'Fresh orange juice with Italian sparkling water', 'price': 109, 'image_url': 'https://images.unsplash.com/photo-1746785011465-17d3d3ab026e?w=400&q=80', 'prep_time_minutes': 2, 'item_type': 'drink'},
        {'name': 'Classic Coca-Cola', 'description': 'Chilled Coca-Cola served over ice', 'price': 69, 'image_url': 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80', 'prep_time_minutes': 1, 'item_type': 'drink'},
        {'name': 'Masala Chai Iced Tea', 'description': 'Spiced Indian chai brewed cold with jaggery', 'price': 99, 'image_url': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80', 'prep_time_minutes': 2, 'item_type': 'drink'},
    ],
    'Snacks & Starters': [
        {'name': 'Onion Rings (8 pcs)', 'description': 'Golden crispy battered onion rings with dip', 'price': 149, 'image_url': 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80', 'prep_time_minutes': 6, 'item_type': 'food'},
        {'name': 'Mozzarella Sticks', 'description': 'Fried mozzarella sticks with marinara dipping sauce', 'price': 189, 'image_url': 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&q=80', 'prep_time_minutes': 7, 'item_type': 'food'},
        {'name': 'Loaded Nachos', 'description': 'Tortilla chips with guacamole, salsa & sour cream', 'price': 229, 'image_url': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&q=80', 'prep_time_minutes': 5, 'item_type': 'food'},
    ],
    'Desserts': [
        {'name': 'Brownie Sundae', 'description': 'Warm fudge brownie topped with vanilla ice cream & caramel', 'price': 229, 'image_url': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80', 'prep_time_minutes': 5, 'item_type': 'food'},
        {'name': 'New York Cheesecake', 'description': 'Classic NY-style cheesecake with berry compote', 'price': 199, 'image_url': 'https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=400&q=80', 'prep_time_minutes': 3, 'item_type': 'food'},
    ],
}

# ── Auth Endpoints ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    restaurant_name: str
    restaurant_description: Optional[str] = ''
    restaurant_address: Optional[str] = ''
    cuisine_type: Optional[str] = 'Multi-Cuisine'

class LoginRequest(BaseModel):
    email: str
    password: str

@api_router.post('/auth/register')
async def register_owner(req: RegisterRequest):
    existing = await db.owners.find_one({'email': req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')

    restaurant_doc = {
        'name': req.restaurant_name,
        'description': req.restaurant_description,
        'address': req.restaurant_address,
        'cuisine_type': req.cuisine_type,
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    res = await db.restaurants.insert_one(restaurant_doc)
    restaurant_id = str(res.inserted_id)

    owner_doc = {
        'name': req.name,
        'email': req.email.lower(),
        'password_hash': hash_password(req.password),
        'restaurant_id': restaurant_id,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    owner_res = await db.owners.insert_one(owner_doc)
    owner_id = str(owner_res.inserted_id)

    # Seed menu
    await _seed_menu(restaurant_id)

    token = create_token({'owner_id': owner_id, 'restaurant_id': restaurant_id})
    return {'token': token, 'owner_id': owner_id, 'restaurant_id': restaurant_id,
            'restaurant_name': req.restaurant_name}

@api_router.post('/auth/login')
async def login_owner(req: LoginRequest):
    owner = await db.owners.find_one({'email': req.email.lower()})
    if not owner or not verify_password(req.password, owner['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    owner_id = str(owner['_id'])
    restaurant_id = owner['restaurant_id']
    rest = await db.restaurants.find_one({'_id': ObjectId(restaurant_id)})
    token = create_token({'owner_id': owner_id, 'restaurant_id': restaurant_id})
    return {'token': token, 'owner_id': owner_id, 'restaurant_id': restaurant_id,
            'restaurant_name': rest['name'] if rest else 'Restaurant'}

# ── Seed helper ───────────────────────────────────────────────────────────────

async def _seed_menu(restaurant_id: str):
    for cat_data in SEED_CATEGORIES:
        cat_doc = {**cat_data, 'restaurant_id': restaurant_id, 'is_active': True}
        res = await db.categories.insert_one(cat_doc)
        cat_id = str(res.inserted_id)
        items = SEED_ITEMS.get(cat_data['name'], [])
        for item in items:
            item_doc = {**item, 'restaurant_id': restaurant_id, 'category_id': cat_id,
                        'category_name': cat_data['name'], 'is_available': True,
                        'created_at': datetime.now(timezone.utc).isoformat()}
            await db.menu_items.insert_one(item_doc)

@api_router.post('/owner/seed-menu')
async def reseed_menu(current=Depends(get_current_owner)):
    rid = current['restaurant_id']
    await db.categories.delete_many({'restaurant_id': rid})
    await db.menu_items.delete_many({'restaurant_id': rid})
    await _seed_menu(rid)
    return {'message': 'Menu seeded successfully'}

# ── Restaurant Endpoints ──────────────────────────────────────────────────────

@api_router.get('/restaurant/{restaurant_id}')
async def get_restaurant(restaurant_id: str):
    try:
        rest = await db.restaurants.find_one({'_id': ObjectId(restaurant_id)})
    except Exception:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    if not rest:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    return to_str_id(rest)

@api_router.put('/owner/restaurant')
async def update_restaurant(data: dict, current=Depends(get_current_owner)):
    rid = current['restaurant_id']
    allowed = ['name', 'description', 'address', 'cuisine_type', 'logo_url']
    update = {k: v for k, v in data.items() if k in allowed}
    await db.restaurants.update_one({'_id': ObjectId(rid)}, {'$set': update})
    rest = await db.restaurants.find_one({'_id': ObjectId(rid)})
    return to_str_id(rest)

@api_router.get('/owner/profile')
async def get_owner_profile(current=Depends(get_current_owner)):
    owner = await db.owners.find_one({'_id': ObjectId(current['owner_id'])})
    rest = await db.restaurants.find_one({'_id': ObjectId(current['restaurant_id'])})
    if not owner:
        raise HTTPException(status_code=404, detail='Owner not found')
    owner_data = to_str_id(owner)
    owner_data.pop('password_hash', None)
    rest_data = to_str_id(rest) if rest else {}
    return {'owner': owner_data, 'restaurant': rest_data}

# ── QR Code Endpoints ─────────────────────────────────────────────────────────

FRONTEND_URL = os.environ.get('REACT_APP_FRONTEND_URL', 'https://smashdine-preview.preview.emergentagent.com')

@api_router.get('/qr/{restaurant_id}/{table_number}')
async def get_qr_code(restaurant_id: str, table_number: int):
    url = f'{FRONTEND_URL}/menu?rid={restaurant_id}&table={table_number}'
    qr_b64 = generate_qr_base64(url)
    return {'qr_code': qr_b64, 'url': url, 'table_number': table_number, 'restaurant_id': restaurant_id}

# ── Menu Endpoints (Public) ───────────────────────────────────────────────────

@api_router.get('/menu/{restaurant_id}')
async def get_menu(restaurant_id: str):
    try:
        rest = await db.restaurants.find_one({'_id': ObjectId(restaurant_id)})
    except Exception:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    if not rest:
        raise HTTPException(status_code=404, detail='Restaurant not found')

    cats = await db.categories.find({'restaurant_id': restaurant_id, 'is_active': True}).sort('sort_order', 1).to_list(100)
    result = []
    for cat in cats:
        cat_id = str(cat['_id'])
        items = await db.menu_items.find({'category_id': cat_id, 'is_available': True}).to_list(100)
        result.append({
            'id': cat_id,
            'name': cat['name'],
            'items': [to_str_id(i) for i in items]
        })
    return {'restaurant': to_str_id(rest), 'categories': result}

# ── Owner Menu Management ─────────────────────────────────────────────────────

@api_router.get('/owner/categories')
async def get_categories(current=Depends(get_current_owner)):
    cats = await db.categories.find({'restaurant_id': current['restaurant_id']}).sort('sort_order', 1).to_list(100)
    return [to_str_id(c) for c in cats]

@api_router.post('/owner/categories')
async def add_category(data: dict, current=Depends(get_current_owner)):
    doc = {'name': data['name'], 'restaurant_id': current['restaurant_id'],
           'sort_order': data.get('sort_order', 99), 'is_active': True}
    res = await db.categories.insert_one(doc)
    doc['id'] = str(res.inserted_id)
    return doc

@api_router.put('/owner/categories/{cat_id}')
async def update_category(cat_id: str, data: dict, current=Depends(get_current_owner)):
    await db.categories.update_one({'_id': ObjectId(cat_id), 'restaurant_id': current['restaurant_id']},
                                   {'$set': {k: v for k, v in data.items() if k in ['name', 'sort_order', 'is_active']}})
    cat = await db.categories.find_one({'_id': ObjectId(cat_id)})
    return to_str_id(cat)

@api_router.delete('/owner/categories/{cat_id}')
async def delete_category(cat_id: str, current=Depends(get_current_owner)):
    await db.categories.delete_one({'_id': ObjectId(cat_id), 'restaurant_id': current['restaurant_id']})
    await db.menu_items.delete_many({'category_id': cat_id})
    return {'message': 'Category deleted'}

@api_router.get('/owner/menu-items')
async def get_owner_menu_items(current=Depends(get_current_owner)):
    items = await db.menu_items.find({'restaurant_id': current['restaurant_id']}).to_list(500)
    return [to_str_id(i) for i in items]

class MenuItemCreate(BaseModel):
    category_id: str
    name: str
    description: str = ''
    price: float
    image_url: str = ''
    prep_time_minutes: int = 8
    item_type: str = 'food'

@api_router.post('/owner/menu-items')
async def add_menu_item(item: MenuItemCreate, current=Depends(get_current_owner)):
    cat = await db.categories.find_one({'_id': ObjectId(item.category_id)})
    doc = item.model_dump()
    doc['restaurant_id'] = current['restaurant_id']
    doc['category_name'] = cat['name'] if cat else ''
    doc['is_available'] = True
    doc['created_at'] = datetime.now(timezone.utc).isoformat()
    res = await db.menu_items.insert_one(doc)
    doc['id'] = str(res.inserted_id)
    return doc

@api_router.put('/owner/menu-items/{item_id}')
async def update_menu_item(item_id: str, data: dict, current=Depends(get_current_owner)):
    allowed = ['name', 'description', 'price', 'image_url', 'prep_time_minutes', 'item_type', 'is_available']
    update = {k: v for k, v in data.items() if k in allowed}
    await db.menu_items.update_one({'_id': ObjectId(item_id), 'restaurant_id': current['restaurant_id']},
                                   {'$set': update})
    item = await db.menu_items.find_one({'_id': ObjectId(item_id)})
    return to_str_id(item)

@api_router.delete('/owner/menu-items/{item_id}')
async def delete_menu_item(item_id: str, current=Depends(get_current_owner)):
    await db.menu_items.delete_one({'_id': ObjectId(item_id), 'restaurant_id': current['restaurant_id']})
    return {'message': 'Item deleted'}

# ── Order Endpoints ───────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    prep_time_minutes: int = 8
    item_type: str = 'food'
    image_url: str = ''

class CreateOrderRequest(BaseModel):
    restaurant_id: str
    table_number: int
    customer_name: str = 'Guest'
    items: List[OrderItemIn]

@api_router.post('/orders')
async def create_order(req: CreateOrderRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail='Cart is empty')
    subtotal = sum(i.price * i.quantity for i in req.items)
    gst_amount = round(subtotal * 0.18, 2)
    total = round(subtotal + gst_amount, 2)
    prep_time = calc_prep_time([i.model_dump() for i in req.items])
    order_id = gen_order_id()
    now = datetime.now(timezone.utc)
    estimated_ready = now + timedelta(minutes=prep_time)

    doc = {
        'order_id': order_id,
        'restaurant_id': req.restaurant_id,
        'table_number': req.table_number,
        'customer_name': req.customer_name,
        'items': [i.model_dump() for i in req.items],
        'subtotal': subtotal,
        'gst_amount': gst_amount,
        'total': total,
        'status': 'pending',
        'payment_status': 'pending',
        'prep_time_minutes': prep_time,
        'estimated_ready_at': estimated_ready.isoformat(),
        'created_at': now.isoformat(),
    }
    await db.orders.insert_one(doc)
    return {
        'order_id': order_id, 'subtotal': subtotal, 'gst_amount': gst_amount,
        'total': total, 'prep_time_minutes': prep_time,
        'estimated_ready_at': estimated_ready.isoformat(), 'status': 'pending'
    }

@api_router.get('/orders/{order_id}')
async def get_order(order_id: str):
    order = await db.orders.find_one({'order_id': order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    game_result = await db.game_results.find_one({'order_id': order_id}, {'_id': 0})
    order['game_result'] = game_result
    return order

# ── Payment Endpoints (Simulated) ─────────────────────────────────────────────

class PaymentRequest(BaseModel):
    order_id: str
    payment_method: str = 'upi'
    customer_name: str = 'Guest'

@api_router.post('/payments/simulate')
async def simulate_payment(req: PaymentRequest):
    order = await db.orders.find_one({'order_id': req.order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    if order.get('payment_status') == 'completed':
        return {'success': True, 'order_id': req.order_id, 'message': 'Already paid'}

    txn_id = 'TXN-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    now = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one({'order_id': req.order_id}, {
        '$set': {'payment_status': 'completed', 'status': 'preparing',
                 'customer_name': req.customer_name, 'payment_method': req.payment_method}
    })
    payment_doc = {'order_id': req.order_id, 'amount': order['total'],
                   'method': req.payment_method, 'txn_id': txn_id,
                   'status': 'completed', 'paid_at': now}
    await db.payments.insert_one(payment_doc)
    return {'success': True, 'order_id': req.order_id, 'txn_id': txn_id,
            'amount': order['total'], 'message': 'Payment successful'}

# ── Game Endpoints ────────────────────────────────────────────────────────────

class GameResultRequest(BaseModel):
    order_id: str
    player_name: str
    won: bool

@api_router.post('/game/result')
async def save_game_result(req: GameResultRequest):
    existing = await db.game_results.find_one({'order_id': req.order_id})
    if existing:
        existing.pop('_id', None)
        return existing

    order = await db.orders.find_one({'order_id': req.order_id}, {'_id': 0})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')

    result = {'order_id': req.order_id, 'player_name': req.player_name, 'won': req.won,
              'created_at': datetime.now(timezone.utc).isoformat()}

    if req.won:
        reward = calc_reward(order.get('total', 0))
        coupon = gen_coupon_code()
        result.update({'reward_type': reward['type'], 'reward_label': reward['label'],
                       'discount_pct': reward['discount_pct'], 'free_drinks': reward['free_drinks'],
                       'coupon_code': coupon})
        await db.orders.update_one({'order_id': req.order_id}, {'$set': {'coupon_code': coupon}})
    else:
        result.update({'reward_type': 'none', 'reward_label': 'Better luck next time!',
                       'discount_pct': 0, 'free_drinks': 0, 'coupon_code': None})

    await db.game_results.insert_one(result)
    result.pop('_id', None)
    return result

@api_router.get('/game/result/{order_id}')
async def get_game_result(order_id: str):
    result = await db.game_results.find_one({'order_id': order_id}, {'_id': 0})
    if not result:
        raise HTTPException(status_code=404, detail='Game result not found')
    return result

# ── Owner Dashboard Endpoints ─────────────────────────────────────────────────

@api_router.get('/owner/orders')
async def get_owner_orders(status: Optional[str] = None, current=Depends(get_current_owner)):
    query = {'restaurant_id': current['restaurant_id']}
    if status:
        query['status'] = status
    orders = await db.orders.find(query, {'_id': 0}).sort('created_at', -1).to_list(200)
    return orders

@api_router.put('/owner/orders/{order_id}/status')
async def update_order_status(order_id: str, data: dict, current=Depends(get_current_owner)):
    new_status = data.get('status')
    valid = ['pending', 'preparing', 'ready', 'served', 'cancelled']
    if new_status not in valid:
        raise HTTPException(status_code=400, detail='Invalid status')
    result = await db.orders.update_one(
        {'order_id': order_id, 'restaurant_id': current['restaurant_id']},
        {'$set': {'status': new_status, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Order not found')
    return {'order_id': order_id, 'status': new_status}

@api_router.get('/owner/analytics')
async def get_analytics(current=Depends(get_current_owner)):
    rid = current['restaurant_id']
    all_orders = await db.orders.find({'restaurant_id': rid, 'payment_status': 'completed'}, {'_id': 0}).to_list(1000)

    total_revenue = sum(o.get('total', 0) for o in all_orders)
    total_orders = len(all_orders)
    avg_order = round(total_revenue / total_orders, 2) if total_orders else 0

    # Status breakdown
    status_counts = {}
    for o in await db.orders.find({'restaurant_id': rid}, {'_id': 0, 'status': 1}).to_list(1000):
        s = o.get('status', 'unknown')
        status_counts[s] = status_counts.get(s, 0) + 1

    # Top items
    item_counts = {}
    for o in all_orders:
        for item in o.get('items', []):
            n = item.get('name', '')
            item_counts[n] = item_counts.get(n, 0) + item.get('quantity', 1)
    top_items = sorted(item_counts.items(), key=lambda x: -x[1])[:8]

    # Revenue by day (last 7 days)
    from collections import defaultdict
    daily = defaultdict(float)
    for o in all_orders:
        date_str = o.get('created_at', '')[:10]
        if date_str:
            daily[date_str] += o.get('total', 0)
    daily_revenue = [{'date': d, 'revenue': round(v, 2)} for d, v in sorted(daily.items())[-7:]]

    # Game stats
    game_wins = await db.game_results.count_documents({'order_id': {'$in': [o['order_id'] for o in all_orders]}, 'won': True})
    game_total = await db.game_results.count_documents({'order_id': {'$in': [o['order_id'] for o in all_orders]}})

    # Table stats
    table_counts = {}
    for o in all_orders:
        t = str(o.get('table_number', 0))
        table_counts[t] = table_counts.get(t, 0) + 1

    return {
        'total_revenue': round(total_revenue, 2),
        'total_orders': total_orders,
        'avg_order_value': avg_order,
        'status_breakdown': status_counts,
        'top_items': [{'name': n, 'count': c} for n, c in top_items],
        'daily_revenue': daily_revenue,
        'game_stats': {'wins': game_wins, 'total': game_total, 'win_rate': round(game_wins/game_total*100) if game_total else 0},
        'top_tables': sorted(table_counts.items(), key=lambda x: -x[1])[:5],
    }

# ── Include router ────────────────────────────────────────────────────────────

app.include_router(api_router)



@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
