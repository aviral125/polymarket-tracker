import React, { useState } from 'react';
import './App.css';
import ContributionChart from './ContributionChart';

// Polymarket Data API endpoint - using React dev server proxy
const POLYMARKET_API_URL = '';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');
  const [error, setError] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [timeRange, setTimeRange] = useState('365'); // '365', '90', '30'
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const handleSearch = async (query) => {
    setWalletAddress(query);
    if (query.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    // Only search if it looks like a name (not an address)
    if (!query.startsWith('0x')) {
        // Since there is no public search API, we will mock this for now
        // or we could implement a "recent searches" or "popular users" list here
        // For now, we'll just hide suggestions to avoid confusion as real search is private
        setShowSuggestions(false);
    } else {
        setShowSuggestions(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (walletAddress.trim()) {
      fetchUserActivity(walletAddress.trim());
    }
  };

  const selectUser = (address) => {
    setWalletAddress(address);
    setShowSuggestions(false);
    fetchUserActivity(address);
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Polymarket Activity Tracker</h1>
        <p className="subtitle">View your Polymarket activity in a GitHub-like contribution chart</p>

        <div className="search-container">
          <form onSubmit={handleSubmit} className="wallet-form">
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Enter Polymarket wallet address (0x...)"
              className="wallet-input"
              disabled={loading}
              onFocus={() => walletAddress.length >= 3 && !walletAddress.startsWith('0x') && setShowSuggestions(true)}
            />
            <button type="submit" className="submit-button" disabled={loading || !walletAddress.trim()}>
              {loading ? 'Loading...' : 'Fetch Activity'}
            </button>
          </form>
          
          {showSuggestions && searchResults.length > 0 && (
            <div className="search-suggestions">
              {searchResults.map((result, index) => (
                <div key={index} className="suggestion-item" onClick={() => selectUser(result.address)}>
                  <div className="suggestion-avatar">
                    {result.profileImage ? (
                      <img src={result.profileImage} alt="profile" />
                    ) : (
                      <div className="suggestion-gradient" style={{ background: getPolymarketGradient(result.address) }} />
                    )}
                  </div>
                  <div className="suggestion-info">
                    <div className="suggestion-name">{result.name || result.pseudonym}</div>
                    <div className="suggestion-address">{result.address.slice(0, 6)}...{result.address.slice(-4)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading && fetchProgress && (
          <div className="loading-progress">
            {fetchProgress}
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {activityData && !loading && (
          <div className="activity-results">
            
            <div className="profile-header">
              <div 
                className="profile-image-container"
                style={{ background: userProfile?.photoUrl ? 'transparent' : userProfile?.gradient }}
              >
                {userProfile?.photoUrl && (
                  <img 
                    src={userProfile.photoUrl} 
                    alt="Profile" 
                    className="profile-image"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="profile-info">
                <h2 className="profile-address">
                  {userProfile?.address.slice(0, 6)}...{userProfile?.address.slice(-4)}
                </h2>
                <span className="profile-type">Polymarket User</span>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{activityData.totalPredictions}</div>
                <div className="stat-label">Total Predictions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{activityData.totalMarkets}</div>
                <div className="stat-label">Markets Interacted</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{activityData.longestStreak} days</div>
                <div className="stat-label">Longest Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {activityData.dateJoined ? activityData.dateJoined.toLocaleDateString() : 'N/A'}
                </div>
                <div className="stat-label">Date Joined</div>
              </div>
            </div>

            <div className="chart-section">
              <div className="chart-header">
                <h2>Activity Heatmap</h2>
                <div className="time-range-controls">
                    <button 
                        className={`range-btn ${timeRange === '30' ? 'active' : ''}`}
                        onClick={() => setTimeRange('30')}
                    >
                        Month
                    </button>
                    <button 
                        className={`range-btn ${timeRange === '90' ? 'active' : ''}`}
                        onClick={() => setTimeRange('90')}
                    >
                        3 Months
                    </button>
                    <button 
                        className={`range-btn ${timeRange === '365' ? 'active' : ''}`}
                        onClick={() => setTimeRange('365')}
                    >
                        Year
                    </button>
                </div>
              </div>
              <ContributionChart 
                activityByDate={activityData.activityByDate} 
                daysToShow={parseInt(timeRange)} 
              />
            </div>

            <div className="activity-history">
              <h2>Activity History</h2>
              <div className="history-list">
                {activityData.activities.slice(0, 50).map((activity, index) => (
                  <div key={index} className="history-item">
                    <div className="history-date">{activity.date.toLocaleDateString()}</div>
                    <div className="history-type">{activity.type}</div>
                    <div className="history-market">{activity.market.question || activity.market.id}</div>
                  </div>
                ))}
                {activityData.activities.length > 50 && (
                  <div className="history-more">
                    ... and {activityData.activities.length - 50} more activities
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

