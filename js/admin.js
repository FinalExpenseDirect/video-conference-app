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
            console.log('Not admin user, skipping admin app init');
            return;
        }

        console.log('Initializing admin app...');
        
        try {
            this.setupEventListeners();
            
            // Load data with a slight delay to ensure auth is ready
            setTimeout(async () => {
                await this.loadInitialData();
                this.startStatsUpdates();
            }, 500);
            
        } catch (error) {
            console.error('Failed to initialize admin app:', error);
            this.showError('Failed to initialize admin interface');
        }
    }

    async loadInitialData() {
        try {
            // Show loading indicators
            this.showLoadingStates();
            
            // Load data sequentially to avoid race conditions
            await this.loadUsers();
            await this.loadRooms();
            await this.loadRecordings();
            await this.updateDashboardStats();
            
            // Hide loading indicators
            this.hideLoadingStates();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load initial data');
            this.hideLoadingStates();
        }
    }

    showLoadingStates() {
        // Show loading for users
        const usersList = document.getElementById('admin-users-list');
        if (usersList) {
            usersList.innerHTML = '<div class="loading-spinner">Loading users...</div>';
        }
        
        // Show loading for rooms
        const roomsList = document.getElementById('admin-rooms-list');
        if (roomsList) {
            roomsList.innerHTML = '<div class="loading-spinner">Loading rooms...</div>';
        }
        
        // Show loading for recordings
        const recordingsList = document.getElementById('admin-recordings-list');
        if (recordingsList) {
            recordingsList.innerHTML = '<div class="loading-spinner">Loading recordings...</div>';
        }
        
        // Show loading for dashboard stats
        const statsElements = [
            'total-users-count',
            'total-recordings-count', 
            'active-rooms-count',
            'online-users-count'
        ];
        
        statsElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '...';
            }
        });
    }

    hideLoadingStates() {
        // Remove any loading spinners
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.remove();
        });
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
        
        // Add refresh button handler
        const refreshBtn = document.getElementById('admin-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.manualRefresh();
            });
        }
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
            console.log('Loading users...');
            const users = await window.auth.apiCall('/api/users');
            console.log('Users loaded:', users.length);
            
            // Only update if we got valid data
            if (Array.isArray(users)) {
                this.users = users;
                this.renderUsers();
            } else {
                throw new Error('Invalid users data received');
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users');
            
            // Don't clear existing data on error
            if (this.users.length === 0) {
                const usersList = document.getElementById('admin-users-list');
                if (usersList) {
                    usersList.innerHTML = '<p class="error-message">Failed to load users. Please try again.</p>';
                }
            }
        }
    }

    async loadRooms() {
        try {
            console.log('Loading rooms...');
            const rooms = await window.auth.apiCall('/api/rooms');
            console.log('Rooms loaded:', rooms.length);
            
            // Only update if we got valid data
            if (Array.isArray(rooms)) {
                this.rooms = rooms;
                this.renderRooms();
            } else {
                throw new Error('Invalid rooms data received');
            }
        } catch (error) {
            console.error('Failed to load rooms:', error);
            this.showError('Failed to load rooms');
            
            // Don't clear existing data on error
            if (this.rooms.length === 0) {
                const roomsList = document.getElementById('admin-rooms-list');
                if (roomsList) {
                    roomsList.innerHTML = '<p class="error-message">Failed to load rooms. Please try again.</p>';
                }
            }
        }
    }

    async loadRecordings() {
        try {
            console.log('Loading recordings...');
            const recordings = await window.auth.apiCall('/api/recordings');
            console.log('Recordings loaded:', recordings.length);
            
            // Only update if we got valid data
            if (Array.isArray(recordings)) {
                this.recordings = recordings;
                this.renderRecordings();
            } else {
                throw new Error('Invalid recordings data received');
            }
        } catch (error) {
            console.error('Failed to load recordings:', error);
            this.showError('Failed to load recordings');
            
            // Don't clear existing data on error
            if (this.recordings.length === 0) {
                const recordingsList = document.getElementById('admin-recordings-list');
                if (recordingsList) {
                    recordingsList.innerHTML = '<p class="error-message">Failed to load recordings. Please try again.</p>';
                }
            }
        }
    }

    async manualRefresh() {
        try {
            this.showInfo('Refreshing data...');
            await this.loadInitialData();
            this.showSuccess('Data refreshed successfully');
        } catch (error) {
            console.error('Manual refresh failed:', error);
            this.showError('Failed to refresh data');
        }
    }

    async checkConnection() {
        try {
            await window.auth.apiCall('/api/health');
            return true;
        } catch (error) {
            console.error('Connection check failed:', error);
            return false;
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
        // Clear any existing interval
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
        }
        
        // Update stats every 30 seconds, but check connection first
        this.statsUpdateInterval = setInterval(async () => {
            try {
                const isConnected = await this.checkConnection();
                if (isConnected) {
                    await this.updateDashboardStats();
                } else {
                    console.log('Connection lost, skipping stats update');
                }
            } catch (error) {
                console.error('Stats update failed:', error);
            }
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

    // Updated room management functions
    manageRoomUsers(roomId) {
        // Show room user management modal
        this.showRoomUserManagementModal(roomId);
    }

    showRoomUserManagementModal(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (!room) return;

        // Create modal HTML
        const modalHtml = `
            <div id="room-user-management-modal" class="modal active">
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>Manage Users - ${room.name}</h3>
                    
                    <div class="room-management-container">
                        <div class="current-members">
                            <h4>Current Members</h4>
                            <div id="current-room-members" class="members-list">
                                Loading...
                            </div>
                        </div>
                        
                        <div class="add-member-section">
                            <h4>Add Member to Room</h4>
                            <div class="form-group">
                                <select id="select-user-for-room">
                                    <option value="">Loading users...</option>
                                </select>
                                <button id="add-user-to-room-btn" class="btn btn-primary">Add Member</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('room-user-management-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Load data and set up event listeners
        this.loadRoomMembersForModal(roomId);
        this.loadMemberUsersForModal();
        this.setupRoomUserModalEvents(roomId);
    }

    async loadRoomMembersForModal(roomId) {
        try {
            const members = await window.auth.apiCall(`/api/rooms/${roomId}/members`);
            this.renderCurrentRoomMembers(members);
        } catch (error) {
            console.error('Failed to load room members:', error);
            document.getElementById('current-room-members').innerHTML = 
                '<p class="error">Failed to load members</p>';
        }
    }

    async loadMemberUsersForModal() {
        try {
            const users = await window.auth.apiCall('/api/users/members');
            this.renderUserSelectorForModal(users);
        } catch (error) {
            console.error('Failed to load users:', error);
            document.getElementById('select-user-for-room').innerHTML = 
                '<option value="">Error loading users</option>';
        }
    }

    renderCurrentRoomMembers(members) {
        const container = document.getElementById('current-room-members');
        if (!container) return;

        if (members.length === 0) {
            container.innerHTML = '<p>No members assigned to this room</p>';
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-name">${this.escapeHtml(member.username)}</div>
                    <div class="member-email">${this.escapeHtml(member.email)}</div>
                </div>
                <div class="member-actions">
                    <button class="btn btn-danger" onclick="adminApp.removeMemberFromRoom(${member.user_id}, this)">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderUserSelectorForModal(users) {
        const selector = document.getElementById('select-user-for-room');
        if (!selector) return;

        selector.innerHTML = '<option value="">Choose a user...</option>' +
            users.map(user => `
                <option value="${user.id}">${this.escapeHtml(user.username)} (${this.escapeHtml(user.email)})</option>
            `).join('');
    }

    setupRoomUserModalEvents(roomId) {
        // Close modal event
        const closeBtn = document.querySelector('#room-user-management-modal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('room-user-management-modal').remove();
            });
        }

        // Add user button event
        const addBtn = document.getElementById('add-user-to-room-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addUserToRoomFromModal(roomId);
            });
        }

        // Click outside to close
        const modal = document.getElementById('room-user-management-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }
    }

    async addUserToRoomFromModal(roomId) {
        const userSelector = document.getElementById('select-user-for-room');
        const userId = userSelector?.value;

        if (!userId) {
            this.showError('Please select a user');
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${roomId}/assign-user`, {
                method: 'POST',
                body: JSON.stringify({ userId: parseInt(userId) })
            });

            this.showSuccess('Member added to room successfully');
            
            // Refresh the members list
            await this.loadRoomMembersForModal(roomId);
            
            // Reset selector
            userSelector.value = '';
        } catch (error) {
            console.error('Failed to add member to room:', error);
            this.showError('Failed to add member to room');
        }
    }

    async removeMemberFromRoom(userId, buttonElement) {
        if (!confirm('Are you sure you want to remove this member from the room?')) {
            return;
        }

        // Get roomId from the modal
        const modal = document.getElementById('room-user-management-modal');
        const titleElement = modal?.querySelector('h3');
        if (!titleElement) return;

        const roomName = titleElement.textContent.replace('Manage Users - ', '');
        const room = this.rooms.find(r => r.name === roomName);
        if (!room) return;

        try {
            await window.auth.apiCall(`/api/rooms/${room.id}/assign-user/${userId}`, {
                method: 'DELETE'
            });

            this.showSuccess('Member removed from room successfully');
            
            // Remove the member item from UI
            const memberItem = buttonElement.closest('.member-item');
            if (memberItem) {
                memberItem.remove();
            }
        } catch (error) {
            console.error('Failed to remove member from room:', error);
            this.showError('Failed to remove member from room');
        }
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
        try {
            // Don't clear existing data, just reload
            console.log('Refreshing all data...');
            
            // Load data without clearing existing data first
            const promises = [
                this.loadUsers(),
                this.loadRooms(), 
                this.loadRecordings()
            ];
            
            await Promise.allSettled(promises);
            await this.updateDashboardStats();
            
            console.log('Data refresh complete');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showError('Failed to refresh some data');
        }
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