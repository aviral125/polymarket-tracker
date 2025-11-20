import React, { useState } from 'react';
import './App.css';
import ContributionChart from './ContributionChart';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [error, setError] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [timeRange, setTimeRange] = useState('365'); // '30', '90', '365'

  // Helper to generate a deterministic gradient based on wallet address
  const getPolymarketGradient = (address) => {
    const addr = address.slice(2, 10); // Use first 8 chars after 0x
    const seed = parseInt(addr, 16);
    
    const h1 = seed % 360;
    const h2 = (h1 + 40) % 360;
    const h3 = (h1 + 90) % 360;
    
    return `linear-gradient(135deg, hsl(${h1}, 85%, 65%), hsl(${h2}, 80%, 70%), hsl(${h3}, 75%, 60%))`;
  };

  const fetchUserActivity = async (wallet) => {
    setLoading(true);
    setError(null);
    setFetchProgress('Starting fetch...');
    setActivityData(null);
    setUserProfile(null);

    try {
      console.log('Fetching activity for wallet:', wallet);
      
      // Set profile with gradient initially
      setUserProfile({
        address: wallet,
        gradient: getPolymarketGradient(wallet),
        photoUrl: null
      });

      // Fetch real profile data
      try {
        const profileRes = await fetch(`http://localhost:3001/api/profile?address=${wallet}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.profileImage) {
            setUserProfile(prev => ({
              ...prev,
              photoUrl: profileData.profileImage,
              name: profileData.name || profileData.pseudonym
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch profile image:', err);
      }

      let allFetchedActivities = [];
      let offset = 0;
      const limit = 500; // Fetch in chunks
      let hasMore = true;
      
      // Loop to fetch all pages of data
      while (hasMore) {
        setFetchProgress(`Fetching items ${offset} - ${offset + limit}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per request

        try {
          const response = await fetch(
            `http://localhost:3001/api/activity?user=${wallet.toLowerCase()}&limit=${limit}&offset=${offset}`, 
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (!response.ok) {
            // If first page fails with 404, it's a real error. 
            // If later page fails, we might just stop and use what we have.
            if (response.status === 404 && allFetchedActivities.length === 0) {
              throw new Error('No activity found for this wallet address.');
            }
            if (!response.ok && allFetchedActivities.length > 0) {
               console.warn(`Page fetch failed at offset ${offset}, stopping pagination.`);
               break; 
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Check content type
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
             if (allFetchedActivities.length > 0) break; // Stop if we get non-JSON mid-stream
             throw new Error('Proxy not working: Received HTML instead of JSON.');
          }

          const activities = await response.json();

          if (!activities || activities.length === 0) {
            hasMore = false;
          } else {
            allFetchedActivities = [...allFetchedActivities, ...activities];
            offset += limit;
            // If we got fewer items than the limit, we've reached the end
            if (activities.length < limit) {
              hasMore = false;
            }
          }
          
          // Safety limit to prevent infinite loops
          if (offset > 50000) {
            console.warn('Hit safety limit of 50,000 items, stopping.');
            hasMore = false;
          }

        } catch (e) {
          console.warn("Error fetching page:", e);
          if (e.name === 'AbortError' && allFetchedActivities.length > 0) {
            // If timed out but we have data, just stop
            break;
          }
          // If first page failed, throw it up
          if (allFetchedActivities.length === 0) throw e;
          hasMore = false;
        }
      }

      if (allFetchedActivities.length === 0) {
        throw new Error('No activity found for this wallet address.');
      }

      console.log(`Total activities fetched: ${allFetchedActivities.length}`);
      setFetchProgress(`Processing ${allFetchedActivities.length} activities...`);

      // Process activities
      const allActivities = allFetchedActivities.map(activity => ({
        type: activity.type?.toLowerCase() || 'trade',
        date: new Date(activity.timestamp * 1000),
        market: {
          id: activity.conditionId || activity.marketId,
          question: activity.title || 'Unknown Market',
        },
        amount: activity.size,
        usdcSize: activity.usdcSize,
        price: activity.price,
        outcome: activity.outcome,
        outcomeIndex: activity.outcomeIndex,
        side: activity.side,
      })).sort((a, b) => b.date - a.date); // Sort newest first

      // Calculate statistics
      const uniqueMarkets = new Set();
      const activityByDate = {};
      let firstActivityDate = null;
      
      const uniquePredictions = new Set();
      const buyTrades = [];

      const getLocalDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      allActivities.forEach(activity => {
        uniqueMarkets.add(activity.market.id);
        const dateKey = getLocalDateKey(activity.date);
        
        if (!activityByDate[dateKey]) {
          activityByDate[dateKey] = 0;
        }
        activityByDate[dateKey]++;

        if (!firstActivityDate || activity.date < firstActivityDate) {
          firstActivityDate = activity.date;
        }
        
        if (activity.side === 'BUY') {
          buyTrades.push(activity);
          const predictionKey = `${activity.market.id}-${activity.outcomeIndex !== undefined ? activity.outcomeIndex : activity.outcome}`;
          uniquePredictions.add(predictionKey);
        }
      });

      // Calculate Longest Streak
      const sortedDates = Object.keys(activityByDate).sort();
      let maxStreak = 0;
      let currentStreak = 0;
      let prevDate = null;

      sortedDates.forEach(dateStr => {
        const currentDate = new Date(dateStr);
        
        if (prevDate) {
            const diffTime = Math.abs(currentDate - prevDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
                currentStreak++;
            } else {
                currentStreak = 1;
            }
        } else {
            currentStreak = 1;
        }
        
        if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
        }
        prevDate = currentDate;
      });

      // Determine best default view
      let defaultView = '365';
      if (firstActivityDate) {
        const daysSinceJoined = Math.ceil((new Date() - firstActivityDate) / (1000 * 60 * 60 * 24));
        if (daysSinceJoined <= 30) defaultView = '30';
        else if (daysSinceJoined <= 90) defaultView = '90';
      }
      setTimeRange(defaultView);

      setActivityData({
        activities: allActivities,
        totalPredictions: buyTrades.length,
        totalMarkets: uniqueMarkets.size,
        dateJoined: firstActivityDate,
        activityByDate,
        uniqueMarkets: Array.from(uniqueMarkets),
        longestStreak: maxStreak,
      });
    } catch (err) {
      console.error('Error fetching activity:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. Check if proxy is running (npm run proxy).');
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Network error. Ensure proxy is running on port 3001.');
      } else {
        setError(err.message || 'Failed to fetch activity data.');
      }
    } finally {
      setLoading(false);
      setFetchProgress('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (walletAddress.trim()) {
      fetchUserActivity(walletAddress.trim());
    }
  };

  const formatDateJoined = (date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  };

  // Render search UI when no data loaded
  if (!activityData && !loading) {
    return (
      <div className="App">
        <div className="bg-blur-layer">
          <div className="bg-blur-image" />
        </div>
        <div className="bg-gradient-overlay" />
        
        <div className="content-wrapper">
          <div className="branding-section">
            <h1 className="branding-title">polygit</h1>
            <p className="branding-subtitle">
              an ongoing experiment to visualise polymarket activity
            </p>
          </div>

          <div className="search-section">
            <h2 className="search-title">Track Your Activity</h2>
            <p className="search-description">
              Enter a Polymarket wallet address to visualize trading activity
            </p>
            
            <form onSubmit={handleSubmit} className="search-form">
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter wallet address (0x...)"
                className="search-input"
                disabled={loading}
              />
              <button 
                type="submit" 
                className="search-button"
                disabled={loading || !walletAddress.trim()}
              >
                {loading ? 'Loading...' : 'Fetch Activity'}
              </button>
            </form>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="bottom-logo">
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Powered by Polymarket</span>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="App">
        <div className="bg-blur-layer">
          <div className="bg-blur-image" />
        </div>
        <div className="bg-gradient-overlay" />
        
        <div className="content-wrapper">
          <div className="search-section">
            <h2 className="search-title">Loading...</h2>
            {fetchProgress && (
              <p className="loading-message">{fetchProgress}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render activity card
  return (
    <div className="App">
      {/* Background Blur Layer */}
      <div className="bg-blur-layer">
        {userProfile?.photoUrl ? (
          <img 
            src={userProfile.photoUrl} 
            className="bg-blur-image"
            alt="Background Blur" 
          />
        ) : (
          <div 
            className="bg-blur-image"
            style={{ background: userProfile?.gradient }}
          />
        )}
      </div>
      <div className="bg-gradient-overlay" />
      
      {/* Main Content */}
      <div className="content-wrapper">
        
        {/* Left Side Branding */}
        <div className="branding-section">
          <h1 className="branding-title">polygit</h1>
          <p className="branding-subtitle">
            an ongoing experiment to visualise polymarket activity
          </p>
        </div>

        {/* Center: The Card */}
        <div className="activity-card">
          
          {/* Top Section: Profile */}
          <div className="profile-section">
            <div 
              className="profile-image-box"
              style={{ background: userProfile?.photoUrl ? 'transparent' : userProfile?.gradient }}
            >
              {userProfile?.photoUrl && (
                <img 
                  src={userProfile.photoUrl} 
                  alt="Profile" 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
            <h2 className="profile-name">
              {userProfile?.name || `${userProfile?.address.slice(0, 6)}...${userProfile?.address.slice(-4)}`}
            </h2>
            
            <div className="stats-row">
              <div className="stat-item">
                <div className="stat-value">{activityData.totalPredictions.toLocaleString()}</div>
                <div className="stat-label">Predictions</div>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <div className="stat-value">{activityData.totalMarkets}</div>
                <div className="stat-label">Markets traded</div>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <div className="stat-value">{formatDateJoined(activityData.dateJoined)}</div>
                <div className="stat-label">Date joined</div>
              </div>
            </div>
          </div>

          {/* Divider with Notches */}
          <div className="card-divider" />

          {/* Bottom Section: Grid + Selector */}
          <div className="chart-section">
            {/* Streak + Time Range Row */}
            <div className="streak-display">
              <div className="streak-info">
                <div className="streak-value">{activityData.longestStreak} days</div>
                <div className="streak-label">Longest streak</div>
              </div>
              
              <div className="selector-wrapper">
                {['30', '90', '365'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`selector-button ${timeRange === range ? 'active' : ''}`}
                  >
                    {range === '30' ? '1M' : range === '90' ? '3M' : '1Y'}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-container">
              <ContributionChart 
                activityByDate={activityData.activityByDate} 
                daysToShow={parseInt(timeRange)} 
              />
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Logo */}
      <div className="bottom-logo">
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Powered by Polymarket</span>
      </div>

    </div>
  );
}

export default App;
