// Admin Interface Module
class AdminApp {
    constructor() {
        this.users = [];
        this.rooms = [];
        this.recordings = [];
        this.activeSessions = [];
        this.currentUser = null;
        this.currentRoom = null;
        this.isInRoom = false;
        this.statsUpdateInterval = null;
    }

    async init() {
        if (!window.auth || !window.auth.hasRole('Admin')) {
            return;
        }

        await this.loadInitialData();
        this.setupEventListeners();
        this.startStatsUpdates();
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadUsers(),
                this.loadRooms(),
                this.loadRecordings(),
                this.updateDashboardStats()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    setupEventListeners() {
        // User management
        this.setupUserManagement();
        
        // Room management
        this.setupRoomManagement();
        
        // Recording management
        this.setupRecordingManagement();
        
        // Modal handling
        this.setupModalHandling();
    }

    setupUserManagement() {
        // Add user button
        const addUserBtn = document.getElementById('admin-add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.showAddUserModal();
            });
        }

        // Add user form
        const addUserForm = document.getElementById('add-user-form');
        if (addUserForm) {
            addUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddUser(e);
            });
        }
    }

    setupRoomManagement() {
        // Add room button
        const addRoomBtn = document.getElementById('admin-add-room-btn');
        if (addRoomBtn) {
            addRoomBtn.addEventListener('click', () => {
                this.showAddRoomModal();
            });
        }

        // Add room form
        const addRoomForm = document.getElementById('add-room-form');
        if (addRoomForm) {
            addRoomForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddRoom(e);
            });
        }
    }

    setupRecordingManagement() {
        // Recording download and view handlers will be set up when rendering
    }

    setupModalHandling() {
        // Close modal buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') || e.target.classList.contains('cancel-btn')) {
                this.closeModals();
            }
        });

        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
    }

    async loadUsers() {
        try {
            this.users = await window.auth.apiCall('/api/users');
            this.renderUsers();
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users');
        }
    }

    async loadRooms() {
        try {
            this.rooms = await window.auth.apiCall('/api/rooms');
            this.renderRooms();
        } catch (error) {
            console.error('Failed to load rooms:', error);
            this.showError('Failed to load rooms');
        }
    }

    async loadRecordings() {
        try {
            this.recordings = await window.auth.apiCall('/api/recordings');
            this.renderRecordings();
        } catch (error) {
            console.error('Failed to load recordings:', error);
            this.showError('Failed to load recordings');
        }
    }

    async updateDashboardStats() {
        try {
            // Update stats on dashboard
            const totalUsersEl = document.getElementById('total-users-count');
            const totalRecordingsEl = document.getElementById('total-recordings-count');
            const activeRoomsEl = document.getElementById('active-rooms-count');
            const onlineUsersEl = document.getElementById('online-users-count');

            if (totalUsersEl) totalUsersEl.textContent = this.users.length;
            if (totalRecordingsEl) totalRecordingsEl.textContent = this.recordings.length;
            if (activeRoomsEl) activeRoomsEl.textContent = this.rooms.filter(r => r.is_active).length;
            
            // Get active sessions (this would need a real API endpoint)
            if (onlineUsersEl) onlineUsersEl.textContent = this.activeSessions.length;

            this.renderActiveSessions();
        } catch (error) {
            console.error('Failed to update dashboard stats:', error);
        }
    }

    startStatsUpdates() {
        // Update stats every 30 seconds
        this.statsUpdateInterval = setInterval(() => {
            this.updateDashboardStats();
        }, 30000);
    }

    renderUsers() {
        const usersList = document.getElementById('admin-users-list');
        if (!usersList) return;

        usersList.innerHTML = '';

        if (this.users.length === 0) {
            usersList.innerHTML = '<p class="text-center">No users found</p>';
            return;
        }

        this.users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = `user-item ${user.is_blocked ? 'user-blocked' : ''}`;
            userElement.innerHTML = `
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.username)}</div>
                    <div class="user-email">${this.escapeHtml(user.email)}</div>
                    <div class="user-role ${user.role.toLowerCase()}">${user.role}</div>
                </div>
                <div class="user-actions">
                    <button class="btn ${user.is_blocked ? 'btn-success' : 'btn-danger'}" 
                            onclick="adminApp.toggleBlockUser(${user.id}, ${!user.is_blocked})">
                        ${user.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                    <button class="btn btn-danger" 
                            onclick="adminApp.deleteUser(${user.id})">
                        Delete
                    </button>
                </div>
            `;

            usersList.appendChild(userElement);
        });
    }

    renderRooms() {
        const roomsList = document.getElementById('admin-rooms-list');
        if (!roomsList) return;

        roomsList.innerHTML = '';

        if (this.rooms.length === 0) {
            roomsList.innerHTML = '<p class="text-center">No rooms found</p>';
            return;
        }

        this.rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            roomElement.innerHTML = `
                <div class="room-info">
                    <div class="room-name">${this.escapeHtml(room.name)}</div>
                    <div class="room-description">${this.escapeHtml(room.description || '')}</div>
                    <div class="room-details">
                        Max Participants: ${room.max_participants} | 
                        Status: ${room.is_active ? 'Active' : 'Inactive'}
                    </div>
                </div>
                <div class="room-actions">
                    <button class="btn btn-primary" 
                            onclick="adminApp.manageRoomUsers(${room.id})">
                        Manage Users
                    </button>
                    <button class="btn btn-danger" 
                            onclick="adminApp.deleteRoom(${room.id})">
                        Delete
                    </button>
                </div>
            `;

            roomsList.appendChild(roomElement);
        });
    }

    renderRecordings() {
        const recordingsList = document.getElementById('admin-recordings-list');
        if (!recordingsList) return;

        recordingsList.innerHTML = '';

        if (this.recordings.length === 0) {
            recordingsList.innerHTML = '<p class="text-center">No recordings found</p>';
            return;
        }

        this.recordings.forEach(recording => {
            const recordingElement = document.createElement('div');
            recordingElement.className = 'recording-item';
            
            const startTime = new Date(recording.start_time).toLocaleString();
            const duration = recording.duration ? `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}` : 'N/A';
            
            recordingElement.innerHTML = `
                <div class="recording-info">
                    <div class="recording-filename">${this.escapeHtml(recording.filename)}</div>
                    <div class="recording-room">Room: ${this.escapeHtml(recording.room_name)}</div>
                    <div class="recording-date">
                        Started: ${startTime} | Duration: ${duration}
                    </div>
                    <div class="recording-user">
                        Recorded by: ${this.escapeHtml(recording.recorded_by_name || 'System')}
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="btn btn-primary" 
                            onclick="adminApp.viewRecording(${recording.id})">
                        View
                    </button>
                    <button class="btn btn-secondary" 
                            onclick="adminApp.downloadRecording(${recording.id})">
                        Download
                    </button>
                </div>
            `;

            recordingsList.appendChild(recordingElement);
        });
    }

    renderActiveSessions() {
        const sessionsList = document.getElementById('active-sessions-list');
        if (!sessionsList) return;

        sessionsList.innerHTML = '';

        if (this.activeSessions.length === 0) {
            sessionsList.innerHTML = '<p class="text-center">No active sessions</p>';
            return;
        }

        this.activeSessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-item';
            sessionElement.innerHTML = `
                <div class="session-info">
                    <div class="session-room">${this.escapeHtml(session.room_name)}</div>
                    <div class="session-user">${this.escapeHtml(session.username)}</div>
                </div>
                <div class="session-status">Active</div>
            `;

            sessionsList.appendChild(sessionElement);
        });
    }

    showAddUserModal() {
        const modal = document.getElementById('add-user-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    showAddRoomModal() {
        const modal = document.getElementById('add-room-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        
        // Reset forms
        document.querySelectorAll('.modal form').forEach(form => {
            form.reset();
        });
    }

    async handleAddUser(event) {
        const formData = new FormData(event.target);
        const userData = {
            username: formData.get('username') || document.getElementById('new-username').value,
            email: formData.get('email') || document.getElementById('new-email').value,
            password: formData.get('password') || document.getElementById('new-password').value,
            role: formData.get('role') || document.getElementById('new-role').value
        };

        if (!userData.username || !userData.email || !userData.password || !userData.role) {
            this.showError('All fields are required');
            return;
        }

        try {
            await window.auth.apiCall('/api/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });

            this.showSuccess('User created successfully');
            this.closeModals();
            await this.loadUsers();
        } catch (error) {
            console.error('Failed to create user:', error);
            this.showError(error.message || 'Failed to create user');
        }
    }

    async handleAddRoom(event) {
        const formData = new FormData(event.target);
        const roomData = {
            name: formData.get('name') || document.getElementById('new-room-name').value,
            description: formData.get('description') || document.getElementById('new-room-description').value,
            max_participants: parseInt(formData.get('max_participants') || document.getElementById('new-room-max-participants').value)
        };

        if (!roomData.name) {
            this.showError('Room name is required');
            return;
        }

        try {
            await window.auth.apiCall('/api/rooms', {
                method: 'POST',
                body: JSON.stringify(roomData)
            });

            this.showSuccess('Room created successfully');
            this.closeModals();
            await this.loadRooms();
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showError(error.message || 'Failed to create room');
        }
    }

    async toggleBlockUser(userId, block) {
        try {
            await window.auth.apiCall(`/api/users/${userId}/block`, {
                method: 'PUT',
                body: JSON.stringify({ blocked: block })
            });

            this.showSuccess(`User ${block ? 'blocked' : 'unblocked'} successfully`);
            await this.loadUsers();
        } catch (error) {
            console.error('Failed to toggle user block status:', error);
            this.showError('Failed to update user status');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await window.auth.apiCall(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            this.showSuccess('User deleted successfully');
            await this.loadUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
            this.showError('Failed to delete user');
        }
    }

    async deleteRoom(roomId) {
        if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${roomId}`, {
                method: 'DELETE'
            });

            this.showSuccess('Room deleted successfully');
            await this.loadRooms();
        } catch (error) {
            console.error('Failed to delete room:', error);
            this.showError('Failed to delete room');
        }
    }

    manageRoomUsers(roomId) {
        // This could open a detailed room management modal
        // For now, show a notification
        this.showInfo('Room user management feature coming soon');
    }

    async downloadRecording(recordingId) {
        try {
            const response = await fetch(`${window.auth.baseURL}/api/recordings/${recordingId}/download`, {
                headers: window.auth.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to download recording');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `recording-${recordingId}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            this.showSuccess('Recording download started');
        } catch (error) {
            console.error('Failed to download recording:', error);
            this.showError('Failed to download recording');
        }
    }

    viewRecording(recordingId) {
        // This could open a video player modal
        // For now, just trigger download
        this.downloadRecording(recordingId);
    }

    // Helper methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    showError(message) {
        window.videoApp.showNotification(message, 'error');
    }

    showSuccess(message) {
        window.videoApp.showNotification(message, 'success');
    }

    showInfo(message) {
        window.videoApp.showNotification(message, 'info');
    }

    // Public methods for external access
    async refreshAllData() {
        await this.loadInitialData();
    }

    getUsers() {
        return this.users;
    }

    getRooms() {
        return this.rooms;
    }

    getRecordings() {
        return this.recordings;
    }

    // Cleanup method
    destroy() {
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
        }
    }
}

// Initialize Admin App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.adminApp) {
        window.adminApp.destroy();
    }
});