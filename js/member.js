// Member Interface Module
class MemberApp {
    constructor() {
        this.rooms = [];
        this.currentRoom = null;
        this.isInRoom = false;
    }

    async init() {
        if (!window.auth || !window.auth.hasRole('Member')) {
            return;
        }

        await this.loadRooms();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Video controls
        const toggleMicBtn = document.getElementById('member-toggle-mic');
        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => {
                window.videoApp.toggleMute();
            });
        }

        const toggleVideoBtn = document.getElementById('member-toggle-video');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', () => {
                window.videoApp.toggleVideo();
            });
        }

        const shareScreenBtn = document.getElementById('member-share-screen');
        if (shareScreenBtn) {
            shareScreenBtn.addEventListener('click', () => {
                window.videoApp.shareScreen();
            });
        }

        const fullscreenBtn = document.getElementById('member-toggle-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                window.videoApp.toggleFullscreen();
            });
        }

        const leaveRoomBtn = document.getElementById('member-leave-room');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }

        // Chat functionality
        const chatInput = document.getElementById('member-chat-input');
        const sendChatBtn = document.getElementById('member-send-chat');
        
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

        // Background selector
        const backgroundSelector = document.getElementById('member-background-color');
        if (backgroundSelector) {
            backgroundSelector.addEventListener('change', (e) => {
                this.changeBackground(e.target.value);
            });
        }

        // View controls
        const galleryViewBtn = document.getElementById('member-gallery-view');
        const speakerViewBtn = document.getElementById('member-speaker-view');
        
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

    async loadRooms() {
        try {
            this.rooms = await window.auth.apiCall('/api/rooms');
            this.renderRooms();
        } catch (error) {
            console.error('Failed to load rooms:', error);
            window.videoApp.showNotification('Failed to load rooms', 'error');
        }
    }

    renderRooms() {
        const roomsList = document.getElementById('member-rooms-list');
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
                await window.videoApp.initializeLocalVideo('member-local-video');
            }

            // Join the room
            await window.videoApp.joinRoom(room.id);
            
            this.currentRoom = room;
            this.isInRoom = true;
            
            // Update UI
            this.updateRoomUI();
            
            window.videoApp.showNotification(`Joined ${room.name}`, 'success');
        } catch (error) {
            console.error('Failed to join room:', error);
            window.videoApp.showNotification('Failed to join room', 'error');
        }
    }

    leaveRoom() {
        if (!this.isInRoom) return;

        window.videoApp.leaveRoom();
        
        this.currentRoom = null;
        this.isInRoom = false;
        
        // Stop local video
        const localVideo = document.getElementById('member-local-video');
        if (localVideo) {
            localVideo.srcObject = null;
        }
        
        // Update UI
        this.updateRoomUI();
        
        window.videoApp.showNotification('Left room', 'info');
    }

    updateRoomUI() {
        // Update room items to show current room
        const roomItems = document.querySelectorAll('#member-rooms-list .room-item');
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
        const videoContainer = document.getElementById('member-video-container');
        if (videoContainer) {
            videoContainer.style.display = this.isInRoom ? 'flex' : 'none';
        }

        // Update leave room button
        const leaveBtn = document.getElementById('member-leave-room');
        if (leaveBtn) {
            leaveBtn.style.display = this.isInRoom ? 'block' : 'none';
        }
    }

    changeBackground(color) {
        if (window.videoApp) {
            window.videoApp.applyBackgroundFilter(color);
        }
    }

    switchView(viewType) {
        const galleryBtn = document.getElementById('member-gallery-view');
        const speakerBtn = document.getElementById('member-speaker-view');
        
        if (galleryBtn && speakerBtn) {
            galleryBtn.classList.toggle('active', viewType === 'gallery');
            speakerBtn.classList.toggle('active', viewType === 'speaker');
        }
        
        if (window.videoApp) {
            window.videoApp.currentView = viewType;
            window.videoApp.updateVideoLayout();
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

    refreshRooms() {
        return this.loadRooms();
    }
}

// Initialize Member App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.memberApp = new MemberApp();
});