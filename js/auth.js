// Authentication Module
class Auth {
    constructor() {
        this.baseURL = 'https://api.finalexpensedirect.org'; // Update with your actual API URL
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.init();
    }

    init() {
        // Check if user is already logged in
        if (this.token && this.user) {
            this.showDashboard(this.user.role);
        } else {
            this.showLogin();
        }

        // Setup login form
        this.setupLoginForm();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin(e);
            });
        }

        // Setup logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.id.includes('logout')) {
                this.logout();
            }
        });
    }

    async handleLogin(e) {
        const formData = new FormData(e.target);
        const credentials = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = '';
        errorDiv.classList.remove('show');

        try {
            const response = await fetch(`${this.baseURL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                this.showDashboard(this.user.role);
            } else {
                this.showError(errorDiv, data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError(errorDiv, 'Network error. Please try again.');
        }
    }

    showError(element, message) {
        element.textContent = message;
        element.classList.add('show');
    }

    showLogin() {
        this.hideAllScreens();
        document.getElementById('login-screen').classList.add('active');
    }

    showDashboard(role) {
        this.hideAllScreens();
        
        switch (role) {
            case 'Member':
                document.getElementById('member-screen').classList.add('active');
                document.getElementById('member-username').textContent = this.user.username;
                if (window.memberApp) {
                    window.memberApp.init();
                }
                break;
            case 'Host':
                document.getElementById('host-screen').classList.add('active');
                document.getElementById('host-username').textContent = this.user.username;
                if (window.hostApp) {
                    window.hostApp.init();
                }
                break;
            case 'Admin':
                document.getElementById('admin-screen').classList.add('active');
                document.getElementById('admin-username').textContent = this.user.username;
                if (window.adminApp) {
                    window.adminApp.init();
                }
                break;
            default:
                console.error('Unknown role:', role);
                this.logout();
        }
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Disconnect socket if connected
        if (window.socket) {
            window.socket.disconnect();
            window.socket = null;
        }
        
        this.showLogin();
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, defaultOptions);
            
            if (response.status === 401 || response.status === 403) {
                this.logout();
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    isAuthenticated() {
        return !!(this.token && this.user);
    }

    getCurrentUser() {
        return this.user;
    }

    hasRole(roles) {
        if (!this.user) return false;
        return Array.isArray(roles) ? roles.includes(this.user.role) : this.user.role === roles;
    }
}

// Initialize Auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.auth = new Auth();
});