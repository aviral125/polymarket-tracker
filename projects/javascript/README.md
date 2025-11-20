# Polymarket Activity Tracker

A React application that visualizes Polymarket wallet activity in a GitHub-like contribution chart. Enter a wallet address to see:

- Total predictions made
- Total markets interacted with
- Date joined (first activity)
- Activity history with dates
- GitHub-style contribution heatmap

## Features

- **Activity Heatmap**: Visual representation of daily activity over the past year, similar to GitHub's contribution graph
- **Statistics Dashboard**: Quick overview of key metrics
- **Activity History**: Detailed list of all positions and trades
- **Real-time Data**: Fetches live data from Polymarket's subgraph

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

The app will run on `http://localhost:3002`

## Usage

1. Enter a Polymarket wallet address (0x...) in the input field
2. Click "Fetch Activity" to retrieve and display the activity data
3. View the contribution chart, statistics, and activity history

## API Notes

This application uses Polymarket's GraphQL subgraph API. The endpoint may change over time. If you encounter issues:

1. Check the [Polymarket Documentation](https://docs.polymarket.com/developers/subgraph/overview) for the latest subgraph endpoint
2. Update the `POLYMARKET_SUBGRAPH_URL` constant in `src/App.js` if needed
3. Verify the GraphQL schema matches the queries in the code

## Technologies

- React 18
- GraphQL (for API queries)
- CSS3 (for styling)

## License

MIT
