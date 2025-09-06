// Host Interface Module
class HostApp {
    constructor() {
        this.rooms = [];
        this.users = [];
        this.currentRoom = null;
        this.isInRoom = false;
        this.selectedRoomForManagement = null;
        this.roomMembers = [];
    }

    async init() {
        if (!window.auth || !window.auth.hasRole(['Host', 'Admin'])) {
            return;
        }

        await this.loadInitialData();
        this.setupEventListeners();
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadRooms(),
                this.loadUsers()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    setupEventListeners() {
        // Video controls
        this.setupVideoControls();
        
        // Chat functionality
        this.setupChatControls();
        
        // View controls
        this.setupViewControls();
        
        // Room management
        this.setupRoomManagement();
    }

    setupVideoControls() {
        const toggleMicBtn = document.getElementById('host-toggle-mic');
        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => {
                window.videoApp.toggleMute();
            });
        }

        const toggleVideoBtn = document.getElementById('host-toggle-video');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => {
                window.videoApp.toggleVideo();
            });
        }

        const shareScreenBtn = document.getElementById('host-share-screen');
        if (shareScreenBtn) {
            shareScreenBtn.addEventListener('click', () => {
                window.videoApp.shareScreen();
            });
        }

        const fullscreenBtn = document.getElementById('host-toggle-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                window.videoApp.toggleFullscreen();
            });
        }

        const startRecordingBtn = document.getElementById('host-start-recording');
        if (startRecordingBtn) {
            startRecordingBtn.addEventListener('click', () => {
                this.toggleRecording();
            });
        }

        const leaveRoomBtn = document.getElementById('host-leave-room');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }
    }

    setupChatControls() {
        const chatInput = document.getElementById('host-chat-input');
        const sendChatBtn = document.getElementById('host-send-chat');
        
        if (chatInput && sendChatBtn) {
            const sendMessage = () => {
                const message = chatInput.value.trim();
                if (message) {
                    window.videoApp.sendChatMessage(message);
                    chatInput.value = '';
                }
            };

            sendChatBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
    }

    setupViewControls() {
        const galleryViewBtn = document.getElementById('host-gallery-view');
        const speakerViewBtn = document.getElementById('host-speaker-view');
        
        if (galleryViewBtn) {
            galleryViewBtn.addEventListener('click', () => {
                this.switchView('gallery');
            });
        }
        
        if (speakerViewBtn) {
            speakerViewBtn.addEventListener('click', () => {
                this.switchView('speaker');
            });
        }
    }

    setupRoomManagement() {
        // Room selector for management
        const roomSelector = document.getElementById('host-select-room');
        if (roomSelector) {
            roomSelector.addEventListener('change', (e) => {
                this.selectRoomForManagement(e.target.value);
            });
        }

        // Add member button
        const addMemberBtn = document.getElementById('host-add-member');
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', () => {
                this.addMemberToRoom();
            });
        }
    }

    async loadRooms() {
        try {
            this.rooms = await window.auth.apiCall('/api/rooms');
            this.renderRooms();
            this.renderRoomSelector();
        } catch (error) {
            console.error('Failed to load rooms:', error);
            this.showError('Failed to load rooms');
        }
    }

    async loadUsers() {
        try {
            // Only load users with Member role for room assignment
            this.users = await window.auth.apiCall('/api/users');
            this.users = this.users.filter(user => user.role === 'Member');
            this.renderUserSelector();
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users');
        }
    }

    renderRooms() {
        const roomsList = document.getElementById('host-rooms-list');
        if (!roomsList) return;

        roomsList.innerHTML = '';

        if (this.rooms.length === 0) {
            roomsList.innerHTML = '<p class="text-center">No rooms available</p>';
            return;
        }

        this.rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            roomElement.innerHTML = `
                <div class="room-name">${this.escapeHtml(room.name)}</div>
                <div class="room-description">${this.escapeHtml(room.description || '')}</div>
                <div class="room-participants">
                    👥 Max: ${room.max_participants}
                </div>
                <button class="join-room-btn" data-room-id="${room.id}">
                    Join Room
                </button>
            `;

            const joinBtn = roomElement.querySelector('.join-room-btn');
            joinBtn.addEventListener('click', () => {
                this.joinRoom(room);
            });

            roomsList.appendChild(roomElement);
        });
    }

    renderRoomSelector() {
        const roomSelector = document.getElementById('host-select-room');
        if (!roomSelector) return;

        roomSelector.innerHTML = '<option value="">Choose a room...</option>';
        
        this.rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            roomSelector.appendChild(option);
        });
    }

    renderUserSelector() {
        const userSelector = document.getElementById('host-select-user');
        if (!userSelector) return;

        userSelector.innerHTML = '<option value="">Choose a user...</option>';
        
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.email})`;
            userSelector.appendChild(option);
        });
    }

    async selectRoomForManagement(roomId) {
        if (!roomId) {
            this.selectedRoomForManagement = null;
            this.roomMembers = [];
            this.renderRoomMembers();
            return;
        }

        this.selectedRoomForManagement = roomId;
        await this.loadRoomMembers(roomId);
    }

    async loadRoomMembers(roomId) {
        try {
            // Get room assignments for this room
            const assignments = await window.auth.apiCall(`/api/rooms/${roomId}/members`);
            this.roomMembers = assignments;
            this.renderRoomMembers();
        } catch (error) {
            console.error('Failed to load room members:', error);
            this.showError('Failed to load room members');
        }
    }

    renderRoomMembers() {
        const membersList = document.getElementById('host-members-list');
        if (!membersList) return;

        membersList.innerHTML = '';

        if (this.roomMembers.length === 0) {
            membersList.innerHTML = '<p class="text-center">No members assigned to this room</p>';
            return;
        }

        this.roomMembers.forEach(member => {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-item';
            memberElement.innerHTML = `
                <div class="member-info">
                    <div class="member-name">${this.escapeHtml(member.username)}</div>
                    <div class="member-email">${this.escapeHtml(member.email)}</div>
                </div>
                <div class="member-actions">
                    <button class="btn btn-danger" onclick="hostApp.removeMemberFromRoom(${member.user_id})">
                        Remove
                    </button>
                </div>
            `;

            membersList.appendChild(memberElement);
        });
    }

    async addMemberToRoom() {
        const roomId = this.selectedRoomForManagement;
        const userSelector = document.getElementById('host-select-user');
        const userId = userSelector?.value;

        if (!roomId || !userId) {
            this.showError('Please select both a room and a user');
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${roomId}/assign-user`, {
                method: 'POST',
                body: JSON.stringify({ userId: parseInt(userId) })
            });

            this.showSuccess('Member added to room successfully');
            await this.loadRoomMembers(roomId);
            
            // Reset user selector
            userSelector.value = '';
        } catch (error) {
            console.error('Failed to add member to room:', error);
            this.showError('Failed to add member to room');
        }
    }

    async removeMemberFromRoom(userId) {
        const roomId = this.selectedRoomForManagement;
        
        if (!roomId || !userId) return;

        if (!confirm('Are you sure you want to remove this member from the room?')) {
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${roomId}/assign-user/${userId}`, {
                method: 'DELETE'
            });

            this.showSuccess('Member removed from room successfully');
            await this.loadRoomMembers(roomId);
        } catch (error) {
            console.error('Failed to remove member from room:', error);
            this.showError('Failed to remove member from room');
        }
    }

    async joinRoom(room) {
        if (this.isInRoom) {
            if (!confirm('You are currently in a room. Do you want to leave and join this room?')) {
                return;
            }
            this.leaveRoom();
        }

        try {
            // Initialize local video if not already done
            if (!window.videoApp.localStream) {
                await window.videoApp.initializeLocalVideo('host-local-video');
            }

            // Join the room
            await window.videoApp.joinRoom(room.id);
            
            this.currentRoom = room;
            this.isInRoom = true;
            
            // Update UI
            this.updateRoomUI();
            
            this.showSuccess(`Joined ${room.name}`);
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showError('Failed to join room');
        }
    }

    leaveRoom() {
        if (!this.isInRoom) return;

        window.videoApp.leaveRoom();
        
        this.currentRoom = null;
        this.isInRoom = false;
        
        // Stop local video
        const localVideo = document.getElementById('host-local-video');
        if (localVideo) {
            localVideo.srcObject = null;
        }
        
        // Update UI
        this.updateRoomUI();
        
        this.showInfo('Left room');
    }

    updateRoomUI() {
        // Update room items to show current room
        const roomItems = document.querySelectorAll('#host-rooms-list .room-item');
        roomItems.forEach(item => {
            const joinBtn = item.querySelector('.join-room-btn');
            const roomId = parseInt(joinBtn.dataset.roomId);
            
            if (this.currentRoom && roomId === this.currentRoom.id) {
                item.classList.add('active');
                joinBtn.textContent = 'Current Room';
                joinBtn.disabled = true;
            } else {
                item.classList.remove('active');
                joinBtn.textContent = 'Join Room';
                joinBtn.disabled = false;
            }
        });

        // Show/hide video container based on room status
        const videoContainer = document.getElementById('host-video-container');
        if (videoContainer) {
            videoContainer.style.display = this.isInRoom ? 'flex' : 'none';
        }

        // Update leave room button
        const leaveBtn = document.getElementById('host-leave-room');
        if (leaveBtn) {
            leaveBtn.style.display = this.isInRoom ? 'block' : 'none';
        }

        // Update recording button
        const recordingBtn = document.getElementById('host-start-recording');
        if (recordingBtn) {
            recordingBtn.style.display = this.isInRoom ? 'block' : 'none';
        }
    }

    toggleRecording() {
        if (!this.isInRoom) {
            this.showError('You must be in a room to start recording');
            return;
        }

        if (window.videoApp.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!window.socket || !this.currentRoom) return;

        window.socket.emit('start-recording', {
            roomId: this.currentRoom.id
        });

        this.showInfo('Starting recording...');
    }

    stopRecording() {
        if (!window.socket) return;

        window.socket.emit('stop-recording', {
            recordingId: window.videoApp.currentRecordingId,
            duration: window.videoApp.getRecordingDuration()
        });

        this.showInfo('Stopping recording...');
    }

    switchView(viewType) {
        const galleryBtn = document.getElementById('host-gallery-view');
        const speakerBtn = document.getElementById('host-speaker-view');
        
        if (galleryBtn && speakerBtn) {
            galleryBtn.classList.toggle('active', viewType === 'gallery');
            speakerBtn.classList.toggle('active', viewType === 'speaker');
        }
        
        if (window.videoApp) {
            window.videoApp.currentView = viewType;
            window.videoApp.updateVideoLayout();
        }
    }

    // Host control methods for managing participants
    async muteParticipant(userId) {
        try {
            // Implement server-side mute functionality
            await window.auth.apiCall(`/api/rooms/${this.currentRoom.id}/mute-user`, {
                method: 'POST',
                body: JSON.stringify({ userId, action: 'mute' })
            });
            
            this.showSuccess('Participant muted');
        } catch (error) {
            console.error('Failed to mute participant:', error);
            this.showError('Failed to mute participant');
        }
    }

    async kickParticipant(userId) {
        if (!confirm('Are you sure you want to kick this participant from the room?')) {
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${this.currentRoom.id}/kick-user`, {
                method: 'POST',
                body: JSON.stringify({ userId })
            });
            
            this.showSuccess('Participant kicked from room');
        } catch (error) {
            console.error('Failed to kick participant:', error);
            this.showError('Failed to kick participant');
        }
    }

    async blockParticipant(userId) {
        if (!confirm('Are you sure you want to block this participant from the room?')) {
            return;
        }

        try {
            await window.auth.apiCall(`/api/rooms/${this.currentRoom.id}/block-user`, {
                method: 'POST',
                body: JSON.stringify({ userId })
            });
            
            this.showSuccess('Participant blocked from room');
        } catch (error) {
            console.error('Failed to block participant:', error);
            this.showError('Failed to block participant');
        }
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
    getCurrentRoom() {
        return this.currentRoom;
    }

    isUserInRoom() {
        return this.isInRoom;
    }

    async refreshData() {
        await this.loadInitialData();
    }

    getSelectedRoomForManagement() {
        return this.selectedRoomForManagement;
    }

    getRoomMembers() {
        return this.roomMembers;
    }
}

// Initialize Host App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.hostApp = new HostApp();
});