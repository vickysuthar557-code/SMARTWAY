// ==========================================
// SMARTWAY CORE CONFIG & INITIALIZATION (2026)
// ==========================================
const SB_URL = 'https://secygumgnuortsdgouiq.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY3lndW1nbnVvcnRzZGdvdWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjYyOTAsImV4cCI6MjA5NDE0MjI5MH0.w9fWEwFmflmsKXj_Boqv2DE95OTw4As97dQ_F8SAXN0';

let sb;
if (typeof supabase !== 'undefined') {
    sb = supabase.createClient(SB_URL, SB_KEY);
    window.sb = sb; 
} else {
    console.error("Supabase CDN library missing!");
}

// STRICT MATCHING: FIXED PACKAGE CONFIGURATIONS FROM YOUR ORIGINAL LOGIC
const miningConfigs = {
    '100':                 { cycle: 1,   cap: 10,   name: 'Trial' },
    'Trial Package — ₹100': { cycle: 1,   cap: 10,   name: 'Trial' }, 
    '1000':                { cycle: 5,  cap: 50,  name: 'Bronze' },
    '2000':                { cycle: 8,  cap: 80,   name: 'Silver' }, 
    '3000':                { cycle: 13,  cap: 130,  name: 'Gold' },
    '5000':                { cycle: 25,  cap: 250,  name: 'Platinum' },
    '10000':               { cycle: 50, cap: 500,  name: 'Diamond' }
};

// ==========================================
// ANTI-CHEAT: MULTI-DEVICE SESSION MIDDLEWARE
// ==========================================
async function verifyActiveDeviceSession(uid) {
    const localToken = localStorage.getItem('session_crypto_key');
    if(!localToken) return false;

    const { data, error } = await sb.from('users').select('utr_number').eq('id', uid).single();
    if (data && data.utr_number && data.utr_number.startsWith('TOKEN:')) {
        const currentActiveDBToken = data.utr_number.replace('TOKEN:', '');
        if (currentActiveDBToken !== localToken) {
            alert("Security Alert: This account is logged into another device. Access Revoked.");
            window.logout();
            return false;
        }
    }
    return true;
}

// ==========================================
// REALTIME UPI LINKING & QR GENERATION
// ==========================================
window.loadRegisterSettings = async () => {
    const upiDisplay = document.getElementById('live-upi-id');
    const displayAmtEl = document.getElementById('display-amt');
    const pkgSelect = document.getElementById('package-select');

    try {
        if(!sb) return;
        const { data: settingsArray, error } = await sb
            .from('app_settings')
            .select('admin_upi')
            .order('id', { ascending: false }) 
            .limit(1);

        if (!error && settingsArray && settingsArray.length > 0) {
            const settings = settingsArray[0];
            if (upiDisplay && settings.admin_upi) {
                upiDisplay.innerText = `UPI: ${settings.admin_upi}`;
            }
            if(pkgSelect && displayAmtEl) {
                displayAmtEl.innerText = pkgSelect.value;
                const qrImg = document.getElementById('admin-qr');
                if (qrImg) {
                    const qrData = `upi://pay?pa=${settings.admin_upi}&am=${pkgSelect.value}&cu=INR&tn=SmartwayPlan${pkgSelect.value}`;
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
                }
            }
        }
    } catch (err) {
        console.error("Failed to compile operational settings pipeline:", err);
    }
};

// ==========================================
// AUTOMATIC DAILY LIMIT RESET ENGINE (12 AM)
// ==========================================
async function checkAndResetDailyLimit(user) {
    if (!user) return user;
    const todayStr = new Date().toLocaleDateString('en-CA'); 

    if (user.last_reset_date !== todayStr) {
        const { data: updatedUser, error } = await sb
            .from('users')
            .update({
                daily_mined_today: 0,
                last_reset_date: todayStr
            })
            .eq('id', user.id)
            .select()
            .single();

        if (!error && updatedUser) {
            return updatedUser;
        }
    }
    return user;
}

// ==========================================
// AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
window.handleRegistration = async () => {
    const name = document.getElementById('reg-name')?.value;
    const phone = document.getElementById('reg-phone')?.value;
    const pass = document.getElementById('reg-password')?.value;
    const ref = document.getElementById('reg-referrer-id')?.value;
    const pkg = document.getElementById('package-select')?.value;
    const utr = document.getElementById('trans-details')?.value;

    if(!name || !phone || !pass || !utr) return alert("Please fill in all the required details to register.");

    const todayStr = new Date().toLocaleDateString('en-CA');

    const { error } = await sb.from('users').insert([{
        full_name: name, phone_number: phone, password_hash: pass,
        referrer_id: ref || null, package_id: pkg, utr_number: utr,
        is_approved: false,
         wallet_balance: 0,
         mining_balance: 0,
         mined_coins: 0,
         bought_coins: 0,
         daily_mined_today: 0,
        last_reset_date: todayStr,
        rate_boost: 0, cap_boost: 0, total_earned_till_date: 0, is_degraded: false
    }]);

    if(error) {
        alert("Registration Failed: " + error.message);
    } else {
        alert("Registration successful! Please wait for admin approval.");
        window.location.href = 'index.html';
    }
};

window.handleUserLogin = async () => {
    const phone = document.getElementById('login-phone')?.value;
    const pass = document.getElementById('login-password')?.value;

    if(!phone || !pass) return alert("Please enter both your phone number and password.");

    const { data, error } = await sb.from('users').select('*').eq('phone_number', phone).eq('password_hash', pass).maybeSingle();

    if(data) {
        if(!data.is_approved) return alert("Your account is currently pending approval from the admin.");
        
        const uniqueToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();
        await sb.from('users').update({ utr_number: `TOKEN:${uniqueToken}` }).eq('id', data.id);
        
        localStorage.clear();
        localStorage.setItem('user_id', data.id);
        localStorage.setItem('is_admin', data.is_admin);
        localStorage.setItem('user_phone', data.phone_number);
        localStorage.setItem('session_crypto_key', uniqueToken); 
        
        window.location.href = 'dashboard.html';
    } else {
        alert("Invalid credentials! Please check your details and try again.");
    }
};

window.logout = () => {
    localStorage.clear();
    window.location.href = 'index.html';
};

// ==========================================
// DYNAMIC 3X LIMIT & DEGRADED CALCULATOR ENGINE (RE-BUILT FOR TRIAL COMMISSION)
// ==========================================
async function calculateFinalPower(user) {
    if (!user) return { finalRate: 10, finalCap: 100 };

    // ==============================
    // 1. HARD DEGRADED STATE CHECK
    // ==============================
    if (user.is_degraded === true) {
        return { finalRate: 1, finalCap: 10 };
    }

    // ==============================
    // 2. PACKAGE BASE CONFIG
    // ==============================
    let baseRate = 1;
    let baseCap = 10;

    if (
        user.package_id === '100' ||
        user.package_id === 100 ||
        user.package_id === 'Trial Package — ₹100'
    ) {
        baseRate = 2;
        baseCap = 10;
    } else {
        const config = miningConfigs[user.package_id] || miningConfigs['100'];
        baseRate = config.cycle;
        baseCap = config.cap;
    }

    // ==============================
    // 3. LIFETIME EARNING 3X CHECK (IMPORTANT FIX)
    // ==============================
    const packageAmount =
        Number(user.package_id) || 100;

    const earned =
        Number(user.total_earned_till_date || 0);

    const limit = packageAmount * 3;

    console.log("PACKAGE:", packageAmount);
    console.log("EARNED:", earned);
    console.log("3X LIMIT:", limit);

    // 🔥 AUTO DEGRADED TRIGGER (THIS WAS MISSING)
    if (earned >= limit) {
        console.log("🔥 3X LIMIT HIT → USER DEGRADED");

        await sb.from('users')
            .update({ is_degraded: true })
            .eq('id', user.id);

        return {
            finalRate: 1,
            finalCap: 10
        };
    }

    // ==============================
    // 4. BOOST SYSTEM
    // ==============================
    let finalRate = baseRate + (parseFloat(user.rate_boost) || 0);
    let finalCap = baseCap + (parseFloat(user.cap_boost) || 0);

    return { finalRate, finalCap };
}
// ==========================================
// DASHBOARD NAVIGATION & DATA ENGINE
// ==========================================
window.loadDashboardData = async () => {
    const uid = localStorage.getItem('user_id');

    if (!uid) {
        console.log('User ID missing');
        return;
    }

    // Profile Phone Sync
    const phoneEl = document.getElementById('profile-display-phone');
    if (phoneEl) {
        phoneEl.innerText =
            localStorage.getItem('user_phone') ||
            'User';
    }

    const secureSessionActive =
        await verifyActiveDeviceSession(uid);

    if (!secureSessionActive) return;

    const {
        data: user,
        error
    } = await sb
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

    if (error) {
        console.error(
            'Dashboard Load Error:',
            error
        );
        return;
    }

    if (!user) {
        console.log('User not found');
        return;
    }

    let freshUser =
        await checkAndResetDailyLimit(user);

    console.log(
        'Dashboard User Loaded:',
        freshUser
    );

    // =====================================
    // Degraded Warning
    // =====================================
    const warningBox =
        document.getElementById(
            'account-degraded-warning'
        );

    if (warningBox) {
        warningBox.style.display =
            freshUser.is_degraded
                ? 'block'
                : 'none';
    }

    // =====================================
    // Global Settings
    // =====================================
    const {
        data: settings
    } = await sb
        .from('app_settings')
        .select('*')
        .single();

    // =====================================
    // Global Mining Counter
    // =====================================
    const globalMiningEl =
        document.getElementById(
            'global-mining-count'
        );

    if (globalMiningEl) {
        const miningCount =
            Number(
                settings?.global_mining || 0
            );

        globalMiningEl.innerText =
            miningCount.toLocaleString(
                'en-IN'
            );
    }

    // =====================================
    // Wallet
    // =====================================
    const walletEl =
        document.getElementById(
            'wallet-balance'
        );

    if (walletEl) {
        walletEl.innerText =
            `₹${Number(
                freshUser.wallet_balance || 0
            ).toFixed(2)}`;
    }
// =====================================
// PURCHASE HISTORY
// =====================================

const { data: purchases } = await sb
    .from('coin_purchase_history')
    .select('coins,amount')
    .eq('user_id', uid);

let invested = 0;
let boughtQty = 0;

(purchases || []).forEach(p => {

    invested += Number(p.amount || 0);

    boughtQty += Number(p.coins || 0);

});

// GLOBAL STORE
window.userBoughtQty = boughtQty;
window.userInvested = invested;

console.log(
    'PURCHASE DATA',
    {
        boughtQty,
        invested
    }
);
// =====================================
// TRANSFER HISTORY
// =====================================

const { data: transfers } = await sb
    .from('coin_transfers')
    .select('*')
    .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
    .order('created_at', { ascending: false });

window.userTransfers = transfers || [];

console.log("TRANSFER HISTORY", transfers);
// =====================================
// SELL HISTORY
// =====================================

const { data: sells } = await sb
    .from('coin_sell_history')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

window.userSellHistory = sells;
console.log("SELL HISTORY", sells);
// =====================================
// PROFIT / LOSS (LIVE RATE)
// =====================================
window.updatePortfolioPL = (
    currentBoughtCoins,
    invested
) => {

    const rate =
        Number(window.currentLiveRate || 0);

    const currentValue =
        Number(currentBoughtCoins || 0) * rate;

    const profitLoss =
        currentValue - Number(invested || 0);

    const plEl =
        document.getElementById(
            'profit-loss'
        );

    if (plEl) {

        plEl.innerText =
            `${profitLoss >= 0 ? '+' : ''}₹${profitLoss.toFixed(2)}`;

        plEl.style.color =
            profitLoss >= 0
                ? '#22c55e'
                : '#ef4444';
    }

    const valueEl =
        document.getElementById(
            'current-portfolio-value'
        );

    if (valueEl) {
        valueEl.innerText =
            `₹${currentValue.toFixed(2)}`;
    }

    const percentEl =
        document.getElementById(
            'profit-loss-percent'
        );

    if (
        percentEl &&
        Number(invested) > 0
    ) {

        const percent =
            (
                profitLoss /
                Number(invested)
            ) * 100;

        percentEl.innerText =
            `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;

        percentEl.style.color =
            percent >= 0
                ? '#22c55e'
                : '#ef4444';
    }
};
// =====================================
// COIN BALANCES
// =====================================

const legacyCoins =
    Number(freshUser.mining_balance || 0);

const minedCoins =
    Number(freshUser.mined_coins || 0);

const boughtCoins =
    Number(freshUser.bought_coins || 0);

const totalCoins =
    legacyCoins +
    minedCoins +
    boughtCoins;
// Total Coins

const coinEl =
    document.getElementById(
        'coin-count'
    );

if (coinEl) {
    coinEl.innerText =
        totalCoins.toFixed(2);
}

// Mined Coins

const minedEl =
    document.getElementById(
        'mined-coins'
    );

if (minedEl) {
    minedEl.innerText =
        minedCoins.toFixed(2);
}

// Bought Coins

const boughtEl =
    document.getElementById(
        'bought-coins'
    );

if (boughtEl) {
    boughtEl.innerText =
        boughtCoins.toFixed(2);
}
const boughtCountEl =
document.getElementById(
'bought-coins-count'
);

if(boughtCountEl){

boughtCountEl.innerText =
boughtCoins.toFixed(2);

}
const currentRate =
    Number(settings?.coin_rate || 0);
window.currentLiveRate = currentRate;
console.log("COIN DEBUG", {
    legacyCoins,
    minedCoins,
    boughtCoins,
    totalCoins,
    currentRate
});

console.log("VALUE DEBUG", {
    totalCoins,
    currentRate,
    totalValue: totalCoins * currentRate
});
window.updatePortfolioPL(
    boughtQty,
    invested
);
const totalValue =
    totalCoins * currentRate;
console.log({
    totalCoins,
    currentRate,
    totalValue
});
const inrEl =
    document.getElementById(
        'coin-inr-value'
    );

if (inrEl) {
    inrEl.innerText =
        `₹${totalValue.toFixed(2)}`;
}
console.log(
    "DOM INR VALUE",
    inrEl?.innerText
);
    // =====================================
    // Package Name Fix
    // =====================================
    const currentPlanText =
        document.getElementById(
            'current-user-plan'
        );

    if (currentPlanText) {

        const currentConf =
            miningConfigs[
                freshUser.package_id
            ];

        let packageName =
            currentConf?.name ||
            `₹${freshUser.package_id}`;

        if (
            freshUser.package_id === 1000
        ) packageName = 'Bronze';

        if (
            freshUser.package_id === 2000
        ) packageName = 'Silver';

        if (
            freshUser.package_id === 3000
        ) packageName = 'Gold';

        if (
            freshUser.package_id === 5000
        ) packageName = 'Platinum';

        if (
            freshUser.package_id === 10000
        ) packageName = 'Diamond';

        currentPlanText.innerText =
            freshUser.is_degraded
                ? 'Trial (3X Reached)'
                : packageName;
    }

    // =====================================
    // Mining Power
    // =====================================
    const power =
        await calculateFinalPower(
            freshUser
        );

    const totalCap =
        Number(power.finalCap || 100);

    const totalMined =
        Number(
            freshUser.daily_mined_today || 0
        );

    const capLeft =
        Math.max(
            0,
            totalCap - totalMined
        );

    const capLeftEl =
        document.getElementById(
            'cap-left'
        );

    if (capLeftEl) {
        capLeftEl.innerText =
            capLeft.toFixed(2);

        capLeftEl.style.color =
            capLeft <= 0
                ? '#ef4444'
                : '#22c55e';
    }

    const capMaxEl =
        document.getElementById(
            'cap-max'
        );

    if (capMaxEl) {
        capMaxEl.innerText =
            totalCap.toFixed(0);
    }

    const rateInfoEl =
        document.getElementById(
            'rate-info'
        );

    if (rateInfoEl) {
        rateInfoEl.innerText =
            `Rate: ${power.finalRate} SMC / Cycle`;
    }

    // =====================================
    // Withdraw Limits
    // =====================================
    const withdrawField =
        document.getElementById(
            'withdraw-amount'
        );

    if (
        withdrawField &&
        settings
    ) {
        const minW =
            Number(
                settings.min_withdrawal ||
                100
            );

        const maxW =
            Number(
                settings.max_withdrawal ||
                10000
            );

        withdrawField.placeholder =
            `Enter Amount (₹${minW} - ₹${maxW})`;
    }

    // =====================================
    // Coin Rate Text
    // =====================================
    const rateText =
        document.getElementById(
            'current-coin-rate-text'
        );

    if (rateText) {
        rateText.innerText =
            `₹${Number(
                settings?.coin_rate || 0
            ).toFixed(2)}`;
    }

    console.log(
        'Dashboard Loaded Successfully'
    );
};
// ==========================================
// DASHBOARD AUTO REFRESH
// ==========================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        await loadDashboardData();

        setInterval(async () => {

            await loadDashboardData();

        }, 10000); // 10 sec

    }
);
// ==========================================
// ECONOMY & COIN CONVERSION (SECURE RPC BACKEND)
// ==========================================
window.processCustomSell = async () => {
    const uid = localStorage.getItem('user_id');
    const inputAmt = parseFloat(document.getElementById('custom-sell-amount').value);

    if (isNaN(inputAmt) || inputAmt <= 0) return alert("Please enter a valid coin amount.");

    const secureSessionActive = await verifyActiveDeviceSession(uid);
    if(!secureSessionActive) return;

    const { error } = await sb.rpc('secure_process_sell', { 
        p_user_id: uid, 
        p_sell_amount: inputAmt 
    });

    if (!error) {
        alert(`Success! ${inputAmt} Coins sold successfully.`);
        document.getElementById('sell-coins-modal').style.display = 'none';
        location.reload();
    } else {
        alert("Transaction Failed: " + error.message);
    }
};
// ==========================================
// REALTIME CHART CONTROLLER (2026 PRO)
// ==========================================
window.currentChartTimeframe = '1M';
window.chartIntervalEngine = null;
window.liveChart = null;

// ✅ ADD THIS HERE (GLOBAL LOCK FLAG)
window.isChartRebuilding = false;
window.buildFreshLiveChart = (points = [], labels = []) => {  
  
    // 🚨 prevent double rebuild crash  
    if (window.isChartRebuilding) return;  
    window.isChartRebuilding = true;  
  
    try {  
  
        if (window.liveChart) {  
            window.liveChart.destroy();  
            window.liveChart = null;  
        }  
  
        const canvas = document.getElementById('rateChartLive');  
        if (!canvas) return;  
  
        const ctx = canvas.getContext('2d');  
  
        const grad = ctx.createLinearGradient(0, 0, 0, 250);  
        grad.addColorStop(0, 'rgba(255,140,0,0.35)');  
        grad.addColorStop(1, 'rgba(255,140,0,0)');  
  
        window.liveChart = new Chart(ctx, {  
            type: 'line',  
            data: {  
                labels: labels,  
                datasets: [{  
                    data: points.map(v => Number(v)),  
  
                    borderColor: (ctx) => {  
                        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 500, 0);  
  
                        gradient.addColorStop(0, '#00e5ff');  
                        gradient.addColorStop(0.5, '#ff8c00');  
                        gradient.addColorStop(1, '#22c55e');  
  
                        return gradient;  
                    },  
  
                    borderWidth: 3,  
                    fill: true,  
                    backgroundColor: grad,  
                    tension: 0.1,  
                    pointRadius: 1,  
                    pointHoverRadius: 5,  
                    pointBackgroundColor: '#ffffff',  
                    pointBorderColor: '#ff8c00',  
                    pointBorderWidth: 2,  
                    pointHitRadius: 12  
                }]  
            },  
  
            options: {  
                responsive: true,  
                maintainAspectRatio: false,  
  
                animation: { duration: 400 },  
  
                interaction: {  
                    intersect: false,  
                    mode: 'index'  
                },  
  
                plugins: {  
                    legend: { display: false },  
  
                    tooltip: {  
                        backgroundColor: '#0f172a',  
                        titleColor: '#fff',  
                        bodyColor: '#fff',  
                        borderColor: '#ff8c00',  
                        borderWidth: 1,  
                        displayColors: false,  
                        callbacks: {  
                            label: (context) =>  
                                '₹' + Number(context.parsed.y).toFixed(2)  
                        }  
                    },  
  
                    zoom: {  
                        pan: { enabled: true, mode: 'x' },  
                        zoom: {  
                            wheel: { enabled: true },  
                            pinch: { enabled: true },  
                            drag: { enabled: true },  
                            mode: 'x'  
                        }  
                    }  
                },  
  
                scales: {  
                    x: {  
                        grid: { display: false },  
                        ticks: {  
                            color: '#64748b',  
                            maxTicksLimit: 10  
                        }  
                    },  
                    y: {  
                        grace: '10%',  
                        grid: { color: 'rgba(255,255,255,0.05)' },  
                        ticks: {  
                            color: '#94a3b8',  
                            callback: v => '₹' + Number(v).toFixed(2)  
                        }  
                    }  
                }  
            }  
        });  
  
    } finally {  
        window.isChartRebuilding = false;  
    }  
};  
window.changeTimeframe = async (tf, btn = null) => {

    window.currentChartTimeframe = tf;

    document
        .querySelectorAll('.tf-btn')
        .forEach(b => b.classList.remove('active'));

    if (btn) btn.classList.add('active');

    let limit = 15;

    if (tf === '5M') limit = 45;
    if (tf === '1H') limit = 120;

    const { data: history, error } = await sb
        .from('rate_history')
          .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error(error);
        return;
    }

    let points = [];
    let labels = [];

    if (!history || history.length === 0) {

        const { data: settings } = await sb
            .from('app_settings')
            .select('coin_rate')
            .single();

        const base = Number(settings?.coin_rate || 1);

        for (let i = 0; i < 30; i++) {
            points.push(
                Number((base + ((Math.random() - 0.5) * 0.4)).toFixed(2))
            );
            labels.push(`${i + 1}`);
        }

    } else {

        const chartData = [...history].reverse();

        points = chartData.map(x => Number(x.rate || 0));

        labels = chartData.map(x => {
            const d = new Date(x.created_at);
            return d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        });
    }

    // ✅ SAFE BUILD (NO CRASH / NO DOUBLE CALL)
    window.buildFreshLiveChart(points, labels);

    const high = Math.max(...points);
    const low = Math.min(...points);
    const current = points[points.length - 1] || 0;

    const highEl = document.getElementById('today-high');
    const lowEl = document.getElementById('today-low');
    const currentEl = document.getElementById('current-coin-rate-text');

    if (highEl) highEl.innerText = `₹${high.toFixed(2)}`;
    if (lowEl) lowEl.innerText = `₹${low.toFixed(2)}`;
    if (currentEl) currentEl.innerText = `₹${current.toFixed(2)}`;
};
// ==========================================
// LIVE LOOP
// ==========================================
window.startChartLoop = async () => {

    if (window.chartIntervalEngine)
        clearInterval(window.chartIntervalEngine);

    let speed = 5000;

    if (window.currentChartTimeframe === '5M') {
        speed = 15000;
    }

    window.chartIntervalEngine = setInterval(async () => {

        const { data: settings } = await sb
            .from('app_settings')
            .select('coin_rate')
            .single();

        if (!settings) return;

        const base = Number(settings.coin_rate || 1);
        const move = (Math.random() * 0.6) - 0.3;

        const liveRate = Number((base + move).toFixed(2));

window.currentLiveRate = liveRate;

console.log(
    'LIVE UPDATE',
    {
        qty: window.userBoughtQty,
        invested: window.userInvested,
        rate: liveRate
    }
);

if (
    window.userBoughtQty !== undefined &&
    window.userInvested !== undefined
) {

    window.updatePortfolioPL(
        window.userBoughtQty,
        window.userInvested
    );
}

const rateEl = document.getElementById(
    'current-coin-rate-text'
);

if (rateEl)
    rateEl.innerText = `₹${liveRate}`;
const inrEl =
document.getElementById(
    'coin-inr-value'
);

if (inrEl) {
const totalCoins =
    parseFloat(
        document.getElementById('coin-count')
        ?.innerText?.replace(/,/g,'') || 0
    );
    
    inrEl.innerText =
        `₹${(totalCoins * liveRate).toFixed(2)}`;
}
        // SAFE UPDATE (no chart crash)
        if (window.liveChart) {

            const data = window.liveChart.data.datasets[0].data;
            const labels = window.liveChart.data.labels;

            data.push(liveRate);

            labels.push(
                new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            );

            if (data.length > 20) {
                data.shift();
                labels.shift();
            }

            window.liveChart.update('none');

            const high = Math.max(...data);
            const low = Math.min(...data);

            const highEl = document.getElementById('today-high');
            const lowEl = document.getElementById('today-low');

            if (highEl) highEl.innerText = `₹${high.toFixed(2)}`;
            if (lowEl) lowEl.innerText = `₹${low.toFixed(2)}`;
        }

    }, speed);
};
// ==========================================
// PACKAGE UPGRADE CHANNELS
// ==========================================

window.updateUpgradePaymentQR = async () => {
    try {

        const upiDisplay = document.getElementById('upgrade-live-upi');
        const displayAmtEl = document.getElementById('upgrade-display-amt');
        const pkgSelect = document.getElementById('modal-package-select');
        const qrImg = document.getElementById('upgrade-admin-qr');

        if (!pkgSelect || !displayAmtEl) return;

        displayAmtEl.innerText = pkgSelect.value;

        let adminUPI = "ssm@ybl";

        const { data } = await sb
            .from('app_settings')
            .select('admin_upi')
            .single();

        if (data?.admin_upi) {
            adminUPI = data.admin_upi;
        }

        if (upiDisplay) {
            upiDisplay.innerText = `UPI: ${adminUPI}`;
        }

        if (qrImg) {

            const qrData =
                `upi://pay?pa=${adminUPI}&pn=Smartway&am=${pkgSelect.value}&cu=INR`;

            qrImg.src =
                `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
        }

    } catch (err) {
        console.error(err);
    }
};

window.submitUpgradeRequest = async () => {

    const uid = localStorage.getItem('user_id');

    if (!uid) {
        alert('Login expired.');
        return;
    }

    const newPkg =
        document.getElementById('modal-package-select')?.value;

    const utr =
        document.getElementById('upgrade-utr-input')?.value?.trim();

    if (!utr || utr.length < 6) {
        return alert('Enter valid UTR number');
    }

    try {

        const { data: user } = await sb
            .from('users')
            .select('package_id')
            .eq('id', uid)
            .single();

        const { error } = await sb
            .from('upgrade_requests')
            .insert([{
                user_id: uid,
                old_package: user.package_id,
                new_package: newPkg,
                utr_number: utr,
                status: 'pending'
            }]);

        if (error) throw error;

        alert('Upgrade request submitted successfully');

        document.getElementById(
            'upgrade-plan-modal'
        ).style.display = 'none';

    } catch (err) {
        alert(err.message);
    }
};
// ==========================================
// BUY COIN SYSTEM (FIXED + LIVE RATE SUPPORT)
// ==========================================

window.buyRate = 1;
window.buyRateHistory = []; // optional for fluctuation feel

window.openBuyCoinModal = async () => {

    try {

        const modal = document.getElementById('buy-coin-modal');
        if (!modal) {
            console.error("BUY MODAL NOT FOUND");
            alert('Buy Coin Modal Not Found');
            return;
        }

        modal.style.display = 'flex';
       await window.loadBuyHistory();
        if (!window.sb) {
            alert("Database connection not ready");
            return;
        }

        // ==============================
        // FETCH SETTINGS
        // ==============================
        const { data, error } = await sb
            .from('app_settings')
            .select('coin_rate, admin_upi')
            .single();

        if (error) throw error;

        // ==============================
        // BASE RATE
        // ==============================
        const baseRate = Number(data?.coin_rate || 1);

        // ==============================
        // SIMULATED FLUCTUATION (LIVE FEEL)
        // ==============================
        const fluctuation = (Math.random() * 0.06) - 0.03; 
        // ±3% change

        window.buyRate = Number((baseRate * (1 + fluctuation)).toFixed(2));

        // optional history store
        window.buyRateHistory.push(window.buyRate);
        if (window.buyRateHistory.length > 50) {
            window.buyRateHistory.shift();
        }

        // ==============================
        // DOM ELEMENTS
        // ==============================
        const rateEl = document.getElementById('buy-current-rate');
        const upiEl = document.getElementById('buy-live-upi');
        const qrEl = document.getElementById('buy-admin-qr');

        // ==============================
        // UPDATE RATE UI
        // ==============================
        if (rateEl) {
            rateEl.innerText = `₹${window.buyRate}`;
        }

        // ==============================
        // UPI DISPLAY
        // ==============================
        const upi = data?.admin_upi || 'N/A';

        if (upiEl) {
            upiEl.innerHTML = `
                <span style="color:#38bdf8;">UPI:</span> ${upi}
            `;
        }

        // ==============================
        // QR GENERATION
        // ==============================
        if (qrEl && upi !== 'N/A') {

            const qrData = `upi://pay?pa=${upi}&pn=Smartway&cu=INR`;

            qrEl.src =
                `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
        }

        // ==============================
        // AUTO PRICE REFRESH (optional live feel)
        // ==============================
        if (!window.buyRateInterval) {

            window.buyRateInterval = setInterval(() => {

                const liveFluctuation = (Math.random() * 0.04) - 0.02;
                const newRate = Number((window.buyRate * (1 + liveFluctuation)).toFixed(2));

                window.buyRate = newRate;

                if (rateEl) {
                    rateEl.innerText = `₹${newRate}`;
                }

            }, 5000); // every 5 sec
        }

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
};
window.calculateBuyAmount = () => {

    const qty = Number(document.getElementById('buy-qty')?.value || 0);

    const amtEl = document.getElementById('buy-amount');

    if (!amtEl) return;

    amtEl.value = (qty * window.buyRate).toFixed(2);
};

window.submitBuyCoinRequest = async () => {

    try {

        const uid = localStorage.getItem('user_id');

        if (!uid) {
            alert('Login expired');
            return;
        }

        const qty = Number(document.getElementById('buy-qty')?.value);
        const amt = Number(document.getElementById('buy-amount')?.value);
        const utr = document.getElementById('buy-utr')?.value?.trim();

        if (!qty || qty <= 0) {
            return alert('Enter valid quantity');
        }

        if (!utr || utr.length < 6) {
            return alert('Enter valid UTR');
        }

        const { error } = await sb
            .from('buy_coin_requests')
            .insert([{
                user_id: uid,
                qty,
                amount: amt,
                utr_number: utr,
                status: 'pending'
            }]);

        if (error) {
            console.error(error);
            throw error;
        }

        alert('Buy Coin Request Submitted');

        document.getElementById('buy-coin-modal').style.display = 'none';

        // reset fields
        document.getElementById('buy-qty').value = '';
        document.getElementById('buy-amount').value = '';
        document.getElementById('buy-utr').value = '';

    } catch (err) {
        alert(err.message);
    }
};
window.openTransferModal = async () => {

    document.getElementById(
        'transfer-modal'
    ).style.display = 'flex';

    await window.loadTransferHistory();
};
// ==========================================
// COIN TRANSFER SYSTEM
// ==========================================
window.transferCoins = async () => {

    const uid = localStorage.getItem('user_id');
    const phone = document.getElementById('transfer-phone').value.trim();
    const qty = Number(document.getElementById('transfer-qty').value);

    if(!phone || qty <= 0){
        return alert("Enter valid details");
    }

    const secure = await verifyActiveDeviceSession(uid);
    if(!secure) return;

    const { data: receiver } = await sb
        .from('users')
        .select('id')
        .eq('phone_number', phone)
        .single();

    if(!receiver){
        return alert("Receiver not found");
    }

    const { error } = await sb.rpc('secure_transfer_coins', {
        p_sender: uid,
        p_receiver: receiver.id,
        p_qty: qty,
    });

    if(error){
        alert(error.message);
        return;
    }

    alert("Transfer successful (10% fee applied)");
    window.loadDashboardData();
};
window.loadTransferHistory = async () => {

    const uid = localStorage.getItem('user_id');

    const { data, error } = await sb
        .from('coin_transfers')
        .select('*')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false });

    const box = document.getElementById(
        'transfer-history-list'
    );

    if (error) {

        console.error(error);

        box.innerHTML =
            '<div class="empty-history">Failed To Load History</div>';

        return;
    }

    if (!data?.length) {

        box.innerHTML =
            '<div class="empty-history">No Transfers Found</div>';

        return;
    }

    box.innerHTML = data.map(x => {

        const isSent =
            String(x.sender_id) === String(uid);

        const type =
            isSent ? 'Sent' : 'Received';

        const badgeClass =
            isSent
                ? 'sent-badge'
                : 'received-badge';

        return `

        <div class="transfer-history-item">

            <div class="history-top">

                <span class="history-title">
                    Coin Transfer
                </span>

                <span class="history-status ${badgeClass}">
                    ${type}
                </span>

            </div>

            <div class="history-amount">
                ${Number(x.coins).toFixed(2)} SMC
            </div>

            <div class="phone-row">

                ${
                    isSent
                    ? `To : ${x.receiver_phone || 'N/A'}`
                    : `From : ${x.sender_phone || 'N/A'}`
                }

            </div>

            <div class="history-sub">

                Fee :
                ${Number(x.fee || 0).toFixed(2)}
                SMC

            </div>

            <div class="history-sub">

                Net :
                ${Number(x.net_coins || 0).toFixed(2)}
                SMC

            </div>

            <div class="history-sub">

                ${new Date(
                    x.created_at
                ).toLocaleString()}

            </div>

        </div>

        `;

    }).join('');

};

window.loadSellHistory = async () => {

    const uid = localStorage.getItem('user_id');

    const { data } = await sb
        .from('coin_sell_history')
        .select('*')
        .eq('user_id', uid)
        .order('created_at',{ascending:false});

    const box =
        document.getElementById(
            'sell-history-list'
        );

    if(!data?.length){

        box.innerHTML =
        '<div class="empty-history">No Sell History</div>';

        return;
    }

    box.innerHTML = data.map(x=>`

        <div class="sell-history-item">

            <div class="history-top">
                <span class="history-title">
                    Coin Sell
                </span>

                <span class="history-status success">
                    Completed
                </span>
            </div>

            <div class="history-amount">
                ${x.coins} SMC
            </div>

            <div class="history-sub">
                Received ₹${x.amount}
            </div>

        </div>

    `).join('');
};
window.loadBuyHistory = async () => {

    const uid =
    localStorage.getItem('user_id');

    const { data } = await sb
        .from('coin_purchase_history')
        .select('*')
        .eq('user_id', uid)
        .order('created_at',{
            ascending:false
        });

    const box =
    document.getElementById(
        'buy-history-list'
    );

    if(!data?.length){

        box.innerHTML =
        '<div class="empty-history">No Buy History</div>';

        return;
    }

    box.innerHTML = data.map(x=>`

        <div class="buy-history-item">

            <div class="history-top">
                <span class="history-title">
                    Buy Order
                </span>

                <span class="history-status success">
                    Completed
                </span>
            </div>

            <div class="history-amount">
                ${x.coins} SMC
            </div>

            <div class="history-sub">
                Amount Paid ₹${x.amount}
            </div>

        </div>

    `).join('');
};
// ==========================================
// ADMIN EXTENSION MODULES
// ==========================================

window.loadAdminUpgradeRequests = async () => {

    const list =
        document.getElementById(
            'upgrade-request-list'
        );

    if (!list) return;

    try {

        const { data, error } = await sb
            .from('upgrade_requests')
            .select(`
                *,
                users(
                    full_name,
                    phone_number
                )
            `)
            .eq('status', 'pending')
            .order('id', {
                ascending: false
            });

        if (error) throw error;

        if (!data || data.length === 0) {

            list.innerHTML =
                `<tr>
                    <td colspan="4"
                    style="text-align:center">
                    No Pending Upgrade Requests
                    </td>
                </tr>`;

            return;
        }

        list.innerHTML = data.map(u => `
            <tr>
                <td>
                    <b>${u.users?.full_name || 'N/A'}</b>
                    <br>
                    <small>${u.users?.phone_number || 'N/A'}</small>
                </td>

                <td>
                    ₹${u.old_package}
                    →
                    <b style="color:#22c55e">
                    ₹${u.new_package}
                    </b>
                </td>

                <td style="color:#ff8c00;font-weight:700">
                    ${u.utr_number}
                </td>

                <td>
                    <button
                        class="btn-s btn-app"
                        onclick="window.approveUpgrade('${u.id}','${u.user_id}','${u.new_package}')">
                        APPROVE
                    </button>

                    <button
                        class="btn-s btn-rej"
                        onclick="window.rejectUpgrade('${u.id}')">
                        REJECT
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {

        console.error(err);

        list.innerHTML =
            `<tr>
                <td colspan="4"
                style="text-align:center;color:red">
                ${err.message}
                </td>
            </tr>`;
    }
};
// ==========================================
// BUY COIN ADMIN MODULE
// ==========================================

window.loadBuyCoinRequests = async () => {

    const list =
        document.getElementById('buy-coin-list');

    if (!list) return;

    list.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center;">
                Loading Requests...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await sb
            .from('buy_coin_requests')
            .select(`
                *,
                users(
                    full_name,
                    phone_number
                )
            `)
            .eq('status', 'pending')
            .order('created_at', {
                ascending: false
            });

        if (error) throw error;

        if (!data || data.length === 0) {

            list.innerHTML = `
                <tr>
                    <td colspan="5"
                    style="text-align:center;">
                        No Pending Requests
                    </td>
                </tr>
            `;

            return;
        }

        list.innerHTML = data.map(req => `
            <tr>

                <td>
                    <b>${req.users?.full_name || 'N/A'}</b>
                    <br>
                    <small>${req.users?.phone_number || 'N/A'}</small>
                </td>

                <td>
                    ${Number(req.qty || 0).toFixed(2)}
                    Coins
                </td>

                <td>
                    ₹${Number(req.amount || 0).toFixed(2)}
                </td>

                <td style="
                    color:#ff8c00;
                    font-weight:700;
                    font-family:monospace;
                ">
                    ${req.utr_number || 'N/A'}
                </td>

                <td>

                    <button
                    class="btn-s btn-app"
                    onclick="window.approveBuyCoin(
                        '${req.id}',
                        '${req.user_id}',
                        ${req.qty}
                    )">
                        APPROVE
                    </button>

                    <button
                    class="btn-s btn-rej"
                    onclick="window.rejectBuyCoin(
                        '${req.id}'
                    )">
                        REJECT
                    </button>

                </td>

            </tr>
        `).join('');

    } catch (err) {

        console.error(err);

        list.innerHTML = `
            <tr>
                <td colspan="5"
                style="color:red;text-align:center;">
                    ${err.message}
                </td>
            </tr>
        `;
    }
};

window.rejectBuyCoin = async (requestId) => {

    if (!confirm('Reject this request ?'))
        return;

    try {

        const { error } = await sb
            .from('buy_coin_requests')
            .update({
                status: 'rejected'
            })
            .eq('id', requestId)
            .eq('status', 'pending');

        if (error) throw error;

        alert('Request Rejected');

        window.loadBuyCoinRequests();

    } catch (err) {

        alert(err.message);
    }
};

// ==========================================
// UPGRADE APPROVAL
// ==========================================

window.approveUpgrade = async (
    requestId,
    userId,
    newPackage
) => {

    if (!confirm(
        'Approve this profile plan upgrade ?'
    )) return;

    try {

        const { error: err1 } = await sb
            .from('upgrade_requests')
            .update({
                status: 'approved'
            })
            .eq('id', requestId)
            .eq('status', 'pending');

        if (err1) throw err1;

        const { error: err2 } = await sb
            .from('users')
            .update({

                package_id: Number(newPackage),

                is_approved: true,

                is_degraded: false,

                total_earned_till_date: 0

            })
            .eq('id', userId);

        if (err2) throw err2;

        alert(
            'Upgrade Approved Successfully'
        );

        window.loadAdminUpgradeRequests();

    } catch (err) {

        alert(err.message);
    }
};

// ==========================================
// BUY COIN APPROVAL
// ==========================================
window.approveBuyCoin = async (
    requestId,
    userId,
    qty
) => {

    if (!confirm(
        `Add ${qty} coins to user wallet ?`
    )) return;

    try {

        const { data: req } = await sb
            .from('buy_coin_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (!req) {
            alert('Request Not Found');
            return;
        }

        if (req.status !== 'pending') {
            alert('Request Already Processed');
            return;
        }

        const { data: user } = await sb
            .from('users')
            .select('bought_coins')
            .eq('id', userId)
            .single();

        if (!user) {
            alert('User Not Found');
            return;
        }

        const { error: userErr } =
            await sb
                .from('users')
                .update({
                    bought_coins:
                        Number(user.bought_coins || 0) +
                        Number(qty)
                })
                .eq('id', userId);

        if (userErr) throw userErr;

        // Purchase History Save
        const { error: historyErr } =
            await sb
                .from('coin_purchase_history')
                .insert([{
                    user_id: userId,
                    coins: Number(qty),
                    amount: Number(req.amount || 0),
                    rate:
                        Number(req.amount || 0) /
                        Number(qty)
                }]);

        if (historyErr) throw historyErr;

        const { error: reqErr } =
            await sb
                .from('buy_coin_requests')
                .update({
                    status: 'approved'
                })
                .eq('id', requestId);

        if (reqErr) throw reqErr;

        alert('Coins Added Successfully');

        window.loadBuyCoinRequests();

    } catch (err) {

        console.error(err);

        alert(err.message);
    }
};
window.rejectUpgrade = async (
    requestId
) => {

    if (!confirm(
        'Reject this upgrade request ?'
    )) return;

    try {

        const { error } = await sb
            .from('upgrade_requests')
            .update({
                status: 'rejected'
            })
            .eq('id', requestId)
            .eq('status', 'pending');

        if (error) throw error;

        alert('Upgrade Rejected');

        window.loadAdminUpgradeRequests();

    } catch (err) {

        alert(err.message);
    }
};
// ==========================================
// ADMIN RATE CONTROL
// ==========================================
window.updateGlobalRate = async () => {

    const rate = parseFloat(
        document.getElementById('new-coin-rate').value
    );

    if(isNaN(rate) || rate <= 0){
        alert("Enter valid coin rate");
        return;
    }

    const { data: settings } = await sb
        .from('app_settings')
        .select('*')
        .single();

    if(!settings){
        alert("Settings not found");
        return;
    }

    let history = settings.rate_history || [];

    history.push({
        time: new Date().toLocaleString(),
        rate: rate
    });

    // keep last 500 records
    if(history.length > 1000){
        history = history.slice(-1000);
    }

    const { error: err1 } = await sb
        .from('app_settings')
        .update({
            coin_rate: rate,
            rate_history: history
        })
        .eq('id', settings.id);

    const { error: err2 } = await sb
        .from('rate_history')
        .insert([{
            rate: rate
        }]);

    if(!err1 && !err2){
        alert("Rate Updated Successfully");
    }else{
        alert(
            err1?.message ||
            err2?.message ||
            "Update failed"
        );
    }
};

// ==========================================
// TAB CONTROLLER
// ==========================================
window.showTab = function(tabId, el){

    document
        .querySelectorAll('.tab-content')
        .forEach(t => t.classList.add('hidden'));

    document
        .querySelectorAll('.admin-tab')
        .forEach(t => t.classList.remove('active'));

    const tab = document.getElementById(
        'tab-' + tabId
    );

    if(tab){
        tab.classList.remove('hidden');
    }

    if(el){
        el.classList.add('active');
    }

    switch(tabId){

        case 'approvals':
            window.loadAdminApprovals();
            break;

        case 'withdrawals':
            window.loadAdminWithdrawals();
            break;

        case 'settings':
            window.loadAdminSettings();
            break;

        case 'upgrades':
            window.loadAdminUpgradeRequests();
            break;

        case 'buycoins':
            window.loadBuyCoinRequests();
            break;
    }
};

// ==========================================
// START MINING
// ==========================================
window.startMiningCycle = async () => {

    const uid = localStorage.getItem('user_id');

    if(!uid){
        alert("Login Required");
        return;
    }

    const secureSessionActive =
        await verifyActiveDeviceSession(uid);

    if(!secureSessionActive) return;

    const { data: active } = await sb
        .from('mining_sessions')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .maybeSingle();

    if(active){
        alert("Mining already running");
        return;
    }

    let { data:user } = await sb
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

    user = await checkAndResetDailyLimit(user);

    const power =
        await calculateFinalPower(user);

    const currentMined =
        Number(user.daily_mined_today || 0);

    const maxCap =
        Number(power.finalCap || 100);

    if(currentMined >= maxCap){
        alert("Daily cap reached");
        return;
    }

    const reward =
        Number(power.finalRate || 10);

    const endTime =
        new Date(
            Date.now() + (30 * 60 * 1000)
        );

    const { error } = await sb
        .from('mining_sessions')
        .insert([{
            user_id: uid,
            end_time: endTime.toISOString(),
            potential_coins: reward,
            is_active: true
        }]);

    if(error){
        alert(error.message);
        return;
    }

    alert("Mining Started 🚀");

    await window.checkActiveMining();
};

// ==========================================
// ACTIVE MINING CHECK
// ==========================================
window.checkActiveMining = async () => {

    const uid = localStorage.getItem('user_id');

    if(!uid) return;

    const { data: session } = await sb
        .from('mining_sessions')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .maybeSingle();

    if(!session) return;

    const timerBox =
        document.getElementById(
            'cycle-timer-box'
        );

    const timerText =
        document.getElementById(
            'timer-text'
        );

    if(timerBox){
        timerBox.style.display = 'block';
    }

    if(window.miningInterval){
        clearInterval(window.miningInterval);
    }

    window.miningInterval =
    setInterval(async ()=>{

        const now = Date.now();

        const end =
            new Date(
                session.end_time
            ).getTime();

        const diff = end - now;

        if(diff <= 0){

            clearInterval(
                window.miningInterval
            );

            window.miningInterval = null;

            if(timerText){
                timerText.innerText = "00:00";
            }

            await window.claimMiningReward(
                session
            );

            return;
        }

        const mins =
            Math.floor(diff / 60000);

        const secs =
            Math.floor(
                (diff % 60000) / 1000
            );

        if(timerText){
            timerText.innerText =
                `${mins}:${
                    secs < 10 ? '0'+secs : secs
                }`;
        }

    },1000);
};

// ==========================================
// CLAIM REWARD
// ==========================================
window.claimMiningReward = async (session) => {

    const uid =
        localStorage.getItem('user_id');

    if(!uid) return;

    if(window.isClaimingInProgress){
        return;
    }

    window.isClaimingInProgress = true;

    try{

        const secureSessionActive =
            await verifyActiveDeviceSession(uid);

        if(!secureSessionActive){
            window.isClaimingInProgress = false;
            return;
        }

        const { error: claimErr } =
        await sb.rpc(
            'secure_claim_mining_reward',
            {
                p_session_id: session.id,
                p_user_id: uid
            }
        );

        if(claimErr){
            alert(claimErr.message);
            window.isClaimingInProgress = false;
            return;
        }

        const earnedCoins =
            Number(
                session.potential_coins || 0
            );

        await sb.rpc(
            'distribute_passive_income',
            {
                p_claimant_id: uid,
                p_amount_mined: earnedCoins
            }
        );

        // GLOBAL MINING UPDATE
        const { data: settings } =
        await sb
            .from('app_settings')
            .select('id,global_mining')
            .single();

        if(settings){

            await sb
                .from('app_settings')
                .update({
                    global_mining:
                        Number(
                            settings.global_mining || 0
                        ) + earnedCoins
                })
                .eq('id', settings.id);
        }

        alert(
            `${earnedCoins} Coins Claimed Successfully`
        );

        await window.loadDashboardData();

        location.reload();

    }catch(err){

        console.error(err);

    }finally{

        window.isClaimingInProgress = false;
    }
};
// ==========================================
// WITHDRAWAL SYSTEM
// ==========================================
window.submitWithdrawal = async () => {

    const uid = localStorage.getItem('user_id');

    if(!uid){
        alert("Login Required");
        return;
    }

    const amt = Number(
        document.getElementById('withdraw-amount')?.value
    );

    const holder =
        document.getElementById('bank-holder')?.value?.trim();

    const acc =
        document.getElementById('bank-account')?.value?.trim();

    const ifsc =
        document.getElementById('bank-ifsc')?.value?.trim().toUpperCase();

    if(
        !holder ||
        !acc ||
        !ifsc ||
        !amt
    ){
        alert("Fill all bank details");
        return;
    }

    if(acc.length < 8){
        alert("Invalid Account Number");
        return;
    }

    const { data: settings } = await sb
        .from('app_settings')
        .select('min_withdrawal,max_withdrawal')
        .single();

    const minAmt =
        Number(settings?.min_withdrawal || 100);

    const maxAmt =
        Number(settings?.max_withdrawal || 10000);

    if(amt < minAmt){
        alert(`Minimum withdrawal ₹${minAmt}`);
        return;
    }

    if(amt > maxAmt){
        alert(`Maximum withdrawal ₹${maxAmt}`);
        return;
    }

    const { data:user } = await sb
        .from('users')
        .select('wallet_balance')
        .eq('id',uid)
        .single();

    if(!user){
        alert("User not found");
        return;
    }

    if(Number(user.wallet_balance) < amt){
        alert("Insufficient Wallet Balance");
        return;
    }

    const bankObj = {
        holder,
        acc,
        ifsc
    };

    const { error } = await sb
        .from('withdrawals')
        .insert([{
            user_id: uid,
            amount: amt,
            bank_details: bankObj,
            status: 'pending'
        }]);

    if(error){
        alert(error.message);
        return;
    }

    await sb
        .from('users')
        .update({
            wallet_balance:
                Number(user.wallet_balance) - amt
        })
        .eq('id',uid);

    alert("Withdrawal Request Submitted");

    window.hideWithdrawModal?.();

    await window.loadDashboardData();

    location.reload();
};

// ==========================================
// WITHDRAW HISTORY
// ==========================================
window.loadHistory = async () => {

    const uid =
        localStorage.getItem('user_id');

    const container =
        document.getElementById('history-list');

    if(!uid || !container) return;

    container.innerHTML =
        `<p style="text-align:center">Loading...</p>`;

    const { data } = await sb
        .from('withdrawals')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', {
            ascending:false
        });

    if(!data || data.length === 0){

        container.innerHTML = `
        <div style="
            text-align:center;
            color:#64748b;
            padding:20px;
        ">
            No Withdrawal History
        </div>
        `;

        return;
    }

    container.innerHTML =
    data.map(w=>{

        let accNo = "N/A";

        try{

            const bank =
                typeof w.bank_details === 'string'
                ? JSON.parse(w.bank_details)
                : w.bank_details;

            if(bank?.acc){
                accNo =
                    "****" +
                    String(bank.acc).slice(-4);
            }

        }catch(err){
            console.error(err);
        }

        const dt =
            w.created_at
            ? new Date(w.created_at)
            : null;

        const formattedDate =
            dt
            ? dt.toLocaleString('en-IN')
            : 'Recent';
         return `
<div class="history-item">

    <div class="history-top">

        <div>

            <div class="history-amount">
                ₹${Number(w.amount).toFixed(2)}
            </div>

            <div class="history-bank">
                💳 ${accNo}
            </div>

            <div class="history-date">
                🕒 ${formattedDate}
            </div>

        </div>

        <div class="history-status status-${String(w.status).toLowerCase()}">
            ${String(w.status).toUpperCase()}
        </div>

    </div>

</div>
`;
    }).join('');
};

// ==========================================
// 10 LEVEL TEAM SYSTEM
// ==========================================
window.loadMultiLevelTeam = async () => {

    const teamList =
        document.getElementById('team-list');

    const totalCount =
        document.getElementById(
            'total-members-count'
        );

    if(!teamList) return;

    const phone =
        localStorage.getItem('user_phone');

    if(!phone) return;

    try{

        const { data: users } = await sb
            .from('users')
            .select(
                'full_name,phone_number,referrer_id'
            );

        if(!users) return;

        let finalTeam = [];
        let parents = [phone];

        for(
            let lvl = 1;
            lvl <= 10;
            lvl++
        ){

            const members =
                users.filter(u =>
                    parents.includes(
                        u.referrer_id
                    )
                );

            if(members.length === 0){
                break;
            }

            members.forEach(m=>{

                finalTeam.push({
                    level:lvl,
                    name:
                        m.full_name ||
                        "Unknown",
                    phone:
                        m.phone_number ||
                        "N/A"
                });

            });

            parents =
                members.map(
                    m => m.phone_number
                );
        }

        totalCount.innerText =
            finalTeam.length;

        if(finalTeam.length === 0){

            teamList.innerHTML =
            `
            <p style="
                text-align:center;
                color:#64748b;
            ">
                No Team Members Yet
            </p>
            `;

            return;
        }

        teamList.innerHTML = '';

        finalTeam.forEach(member=>{

            const hiddenPhone =
                String(member.phone)
                .slice(0,4) +
                "****";

            teamList.insertAdjacentHTML(
                'beforeend',
                `
                <div class="member-item">

                    <div>

                        <div style="
                            font-weight:700;
                            font-size:15px;
                        ">
                            ${member.name}
                        </div>

                        <div style="
                            color:#64748b;
                            font-size:12px;
                        ">
                            ${hiddenPhone}
                        </div>

                    </div>

                    <span class="
                    lvl-badge
                    lvl-${Math.min(member.level,5)}
                    ">
                        Level ${member.level}
                    </span>

                </div>
                `
            );

        });

    }catch(err){

        console.error(err);

    }
};

// ==========================================
// AUTO RESUME MINING
// ==========================================
if(
    localStorage.getItem('user_id') &&
    window.location.pathname.includes(
        'dashboard.html'
    )
){
    setTimeout(()=>{
        window.checkActiveMining();
    },1000);
}

// ==========================================
// PAGE INIT
// ==========================================
document.addEventListener(
    'DOMContentLoaded',
    async ()=>{

        if(
            document.getElementById(
                'live-upi-id'
            )
        ){
            if(
                typeof window.loadRegisterSettings
                === 'function'
            ){
                await window.loadRegisterSettings();
            }
        }

    }
);
