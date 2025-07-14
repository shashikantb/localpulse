
'use server';

import { getAdminDashboardStatsDb } from '@/lib/db';

export async function getAdminDashboardStats() {
    try {
        return await getAdminDashboardStatsDb();
    } catch (error) {
        console.error('Failed to get admin dashboard stats:', error);
        // Return zeroed stats on error to prevent crashing the dashboard
        return { totalUsers: 0, totalPosts: 0, dailyActiveUsers: 0 };
    }
}
