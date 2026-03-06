"""SmashDine Backend API Tests - Full MVP coverage"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = 'test@demo.com'
TEST_PASSWORD = 'demo123'
TEST_RESTAURANT_ID = '69aa9b205d58c61a0db8bf88'


@pytest.fixture(scope='module')
def auth_token():
    resp = requests.post(f'{BASE_URL}/api/auth/login', json={'email': TEST_EMAIL, 'password': TEST_PASSWORD})
    if resp.status_code == 200:
        return resp.json()['token']
    pytest.skip(f'Login failed: {resp.status_code} {resp.text}')


@pytest.fixture(scope='module')
def auth_headers(auth_token):
    return {'Authorization': f'Bearer {auth_token}', 'Content-Type': 'application/json'}


# Auth tests
class TestAuth:
    def test_login_success(self):
        resp = requests.post(f'{BASE_URL}/api/auth/login', json={'email': TEST_EMAIL, 'password': TEST_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert 'token' in data
        assert 'restaurant_id' in data
        assert data['restaurant_id'] == TEST_RESTAURANT_ID

    def test_login_invalid(self):
        resp = requests.post(f'{BASE_URL}/api/auth/login', json={'email': 'bad@bad.com', 'password': 'wrong'})
        assert resp.status_code == 401

    def test_register_duplicate_email(self):
        resp = requests.post(f'{BASE_URL}/api/auth/register', json={
            'name': 'Test', 'email': TEST_EMAIL, 'password': 'test123',
            'restaurant_name': 'Duplicate Test'
        })
        assert resp.status_code == 400


# Restaurant tests
class TestRestaurant:
    def test_get_restaurant(self):
        resp = requests.get(f'{BASE_URL}/api/restaurant/{TEST_RESTAURANT_ID}')
        assert resp.status_code == 200
        data = resp.json()
        assert 'id' in data
        assert 'name' in data

    def test_get_restaurant_invalid(self):
        resp = requests.get(f'{BASE_URL}/api/restaurant/000000000000000000000000')
        assert resp.status_code == 404


# Menu tests
class TestMenu:
    def test_get_menu(self):
        resp = requests.get(f'{BASE_URL}/api/menu/{TEST_RESTAURANT_ID}')
        assert resp.status_code == 200
        data = resp.json()
        assert 'restaurant' in data
        assert 'categories' in data
        assert len(data['categories']) >= 5, f"Expected 5 categories, got {len(data['categories'])}"

    def test_menu_has_items(self):
        resp = requests.get(f'{BASE_URL}/api/menu/{TEST_RESTAURANT_ID}')
        assert resp.status_code == 200
        categories = resp.json()['categories']
        for cat in categories:
            assert len(cat['items']) > 0, f"Category {cat['name']} has no items"


# QR Code test
class TestQR:
    def test_qr_code_generation(self):
        resp = requests.get(f'{BASE_URL}/api/qr/{TEST_RESTAURANT_ID}/1')
        assert resp.status_code == 200
        data = resp.json()
        assert 'qr_code' in data
        assert data['qr_code'].startswith('data:image/png;base64,')
        assert data['table_number'] == 1


# Order tests
class TestOrders:
    order_id = None

    def test_create_order(self):
        resp = requests.post(f'{BASE_URL}/api/orders', json={
            'restaurant_id': TEST_RESTAURANT_ID,
            'table_number': 5,
            'customer_name': 'TEST_Customer',
            'items': [
                {'menu_item_id': 'item1', 'name': 'Classic Beef Burger', 'price': 249, 'quantity': 1, 'prep_time_minutes': 8, 'item_type': 'food', 'image_url': ''}
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert 'order_id' in data
        assert data['subtotal'] == 249
        assert data['gst_amount'] == round(249 * 0.18, 2)
        TestOrders.order_id = data['order_id']

    def test_get_order(self):
        if not TestOrders.order_id:
            pytest.skip('No order_id from previous test')
        resp = requests.get(f'{BASE_URL}/api/orders/{TestOrders.order_id}')
        assert resp.status_code == 200
        data = resp.json()
        assert data['order_id'] == TestOrders.order_id
        assert data['table_number'] == 5

    def test_get_order_not_found(self):
        resp = requests.get(f'{BASE_URL}/api/orders/NONEXISTENT-ORDER')
        assert resp.status_code == 404


# Payment tests
class TestPayment:
    def test_simulate_payment(self):
        # Create order first
        resp = requests.post(f'{BASE_URL}/api/orders', json={
            'restaurant_id': TEST_RESTAURANT_ID,
            'table_number': 3,
            'customer_name': 'TEST_PayCustomer',
            'items': [{'menu_item_id': 'item1', 'name': 'Oreo Shake', 'price': 199, 'quantity': 1, 'prep_time_minutes': 4, 'item_type': 'shake', 'image_url': ''}]
        })
        assert resp.status_code == 200
        order_id = resp.json()['order_id']

        # Simulate payment
        pay_resp = requests.post(f'{BASE_URL}/api/payments/simulate', json={
            'order_id': order_id, 'payment_method': 'upi', 'customer_name': 'TEST_PayCustomer'
        })
        assert pay_resp.status_code == 200
        data = pay_resp.json()
        assert data['success'] == True
        assert 'txn_id' in data

        # Verify order status updated to preparing
        order_resp = requests.get(f'{BASE_URL}/api/orders/{order_id}')
        assert order_resp.json()['status'] == 'preparing'
        assert order_resp.json()['payment_status'] == 'completed'


# Game result tests
class TestGame:
    def test_save_game_result_win(self):
        # Create and pay order first
        resp = requests.post(f'{BASE_URL}/api/orders', json={
            'restaurant_id': TEST_RESTAURANT_ID,
            'table_number': 7,
            'customer_name': 'TEST_Gamer',
            'items': [{'menu_item_id': 'item1', 'name': 'Double Smash Burger', 'price': 399, 'quantity': 2, 'prep_time_minutes': 10, 'item_type': 'food', 'image_url': ''}]
        })
        order_id = resp.json()['order_id']
        requests.post(f'{BASE_URL}/api/payments/simulate', json={'order_id': order_id, 'payment_method': 'upi', 'customer_name': 'TEST_Gamer'})

        # Save win result
        game_resp = requests.post(f'{BASE_URL}/api/game/result', json={
            'order_id': order_id, 'player_name': 'TEST_Gamer', 'won': True
        })
        assert game_resp.status_code == 200
        data = game_resp.json()
        assert data['won'] == True
        assert 'reward_type' in data
        assert 'coupon_code' in data
        assert data['coupon_code'] is not None

    def test_get_game_result_not_found(self):
        resp = requests.get(f'{BASE_URL}/api/game/result/NONEXISTENT')
        assert resp.status_code == 404


# Owner protected endpoints
class TestOwnerEndpoints:
    def test_owner_orders(self, auth_headers):
        resp = requests.get(f'{BASE_URL}/api/owner/orders', headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_owner_categories(self, auth_headers):
        resp = requests.get(f'{BASE_URL}/api/owner/categories', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 5

    def test_owner_menu_items(self, auth_headers):
        resp = requests.get(f'{BASE_URL}/api/owner/menu-items', headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) > 0

    def test_owner_analytics(self, auth_headers):
        resp = requests.get(f'{BASE_URL}/api/owner/analytics', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert 'total_revenue' in data
        assert 'total_orders' in data
        assert 'top_items' in data

    def test_owner_profile(self, auth_headers):
        resp = requests.get(f'{BASE_URL}/api/owner/profile', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert 'owner' in data
        assert 'restaurant' in data

    def test_owner_orders_no_auth(self):
        resp = requests.get(f'{BASE_URL}/api/owner/orders')
        assert resp.status_code in [401, 403, 422]

    def test_update_order_status(self, auth_headers):
        # Create an order first
        resp = requests.post(f'{BASE_URL}/api/orders', json={
            'restaurant_id': TEST_RESTAURANT_ID,
            'table_number': 10,
            'customer_name': 'TEST_StatusUpdate',
            'items': [{'menu_item_id': 'item1', 'name': 'Test Item', 'price': 100, 'quantity': 1, 'prep_time_minutes': 5, 'item_type': 'food', 'image_url': ''}]
        })
        order_id = resp.json()['order_id']

        # Pay for it
        requests.post(f'{BASE_URL}/api/payments/simulate', json={'order_id': order_id, 'payment_method': 'upi', 'customer_name': 'TEST_StatusUpdate'})

        # Update status
        update_resp = requests.put(f'{BASE_URL}/api/owner/orders/{order_id}/status', json={'status': 'ready'}, headers=auth_headers)
        assert update_resp.status_code == 200
        assert update_resp.json()['status'] == 'ready'
