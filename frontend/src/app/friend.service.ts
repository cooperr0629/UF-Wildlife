import { Injectable } from '@angular/core';

const API = 'http://localhost:8080/api';

export interface Friend {
  friendship_id: number;
  friend_id: number;
  username: string;
}

export interface FriendRequest {
  id: number;
  requester_id: number;
  username: string;
  created_at: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  receiver_id: number;
  content: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FriendService {

  async sendFriendRequest(requesterId: string, receiverUsername: string): Promise<{ status: string }> {
    let res: Response;
    try {
      res = await fetch(`${API}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: parseInt(requesterId, 10), receiver_username: receiverUsername }),
      });
    } catch (networkErr) {
      console.error('[FriendService] Network error:', networkErr);
      throw new Error('Cannot reach server. Is the backend running?');
    }
    let data: any = {};
    try { data = await res.json(); } catch { /* non-JSON body */ }
    console.log('[FriendService] sendFriendRequest response:', res.status, data);
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    return data;
  }

  async getFriends(userId: string): Promise<Friend[]> {
    const res = await fetch(`${API}/friends?user_id=${userId}`);
    if (!res.ok) return [];
    return res.json();
  }

  async getFriendRequests(userId: string): Promise<FriendRequest[]> {
    const res = await fetch(`${API}/friends/requests?user_id=${userId}`);
    if (!res.ok) return [];
    return res.json();
  }

  async acceptRequest(friendshipId: number, userId: string): Promise<void> {
    await fetch(`${API}/friends/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendshipId, user_id: parseInt(userId, 10) }),
    });
  }

  async declineRequest(friendshipId: number, userId: string): Promise<void> {
    await fetch(`${API}/friends/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendshipId, user_id: parseInt(userId, 10) }),
    });
  }

  async removeFriend(userId: string, friendId: number): Promise<void> {
    await fetch(`${API}/friends/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id: friendId, user_id: parseInt(userId, 10) }),
    });
  }

  async getMessages(user1: string, user2: number): Promise<DirectMessage[]> {
    const res = await fetch(`${API}/dm?user1=${user1}&user2=${user2}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async sendMessage(senderId: string, receiverId: number, content: string): Promise<void> {
    await fetch(`${API}/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: parseInt(senderId, 10), receiver_id: receiverId, content }),
    });
  }
}
