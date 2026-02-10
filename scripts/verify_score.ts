
import { calculateFertyScore } from '../services/fertyscoreService';
import { UserProfile, DailyLog } from '../types';
import { FertyPillars } from '../services/fertyscoreService';

const mockUser: UserProfile = {
    id: 'test-user',
    name: 'Test',
    age: 35,
    weight: 60,
    height: 165,
    cycleLength: 28,
    cycleRegularity: 'Regular',
    smoker: 'No',
    isOnboarded: true,
    treatments: []
};

const mockLogs: DailyLog[] = [
    { date: '2023-01-01', cycleDay: 1, sleepHours: 8, stressLevel: 2, symptoms: ['hinchazon'], alcohol: false, bbt: 36.5, mucus: '', lhTest: '', sleepQuality: 5, waterGlasses: 8, veggieServings: 5, activityMinutes: 30, sunMinutes: 10 },
    { date: '2023-01-02', cycleDay: 2, sleepHours: 6, stressLevel: 4, symptoms: [], alcohol: true, bbt: 36.6, mucus: '', lhTest: '', sleepQuality: 3, waterGlasses: 6, veggieServings: 3, activityMinutes: 0, sunMinutes: 0 },
    { date: '2023-01-03', cycleDay: 3, sleepHours: 7.5, stressLevel: 1, symptoms: ['gases'], alcohol: false, bbt: 36.4, mucus: '', lhTest: '', sleepQuality: 4, waterGlasses: 10, veggieServings: 4, activityMinutes: 45, sunMinutes: 20 },
];

const mockPillars: FertyPillars = {
    function: { user_id: 'test', cycle_length: 28 }, // incomplete but verify basics
    food: { user_id: 'test', vegetable_servings: 5, alcohol_consumption: 'no tomo' },
    flora: { user_id: 'test', digestive_health: 8 },
    flow: { user_id: 'test', stress_level: 2, sleep_hours: 8 }
};

console.log('Running FertyScore Verification...');
try {
    const scores = calculateFertyScore(mockUser, mockLogs, mockPillars);
    console.log('Scores:', JSON.stringify(scores, null, 2));

    // Verify Logic
    if (scores.total >= 0 && scores.total <= 100) console.log('✅ Global Score within range');
    else console.error('❌ Global Score out of range');

    console.log('Specific Checks:');
    // Check Flow Dynamic: Sleep (50%) + Stress (50%)
    // Avg Sleep: (8+6+7.5)/3 = 7.16 -> >7 -> 100 pts
    // Avg Stress: (2+4+1)/3 = 2.33 -> >2 -> 70 pts?
    // Flow Dynamic = 0.5*100 + 0.5*70 = 85?
    // Baseline Flow: stress=2 (>8), sleep=8 (>8). Let's say baseline is high.
    // We can manually calc what we expect if we want deep verification.

    if (scores.flow > 0) console.log('✅ Flow Score Calculated');

} catch (e) {
    console.error('❌ Error during calculation:', e);
}
