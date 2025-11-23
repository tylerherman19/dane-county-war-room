# Comprehensive Race Testing Guide

## Issue Found
The user was viewing **Election 185: 2025 DeForest Recall Primary**, which:
- Has race "BALLOTS CAST - TOTAL" (Race 0002)
- Is correctly classified as "Other" race type
- Has NO historical comparison data (correct behavior)

This is why the tooltip showed "Prev Margin: 0.0%" - there's no historical data for this race type.

## Test Plan: Every Race Type

### 1. Presidential Race
**Election**: 172 (2024 General Election)
**Expected**: Should compare to 2020 Presidential race

**Steps**:
1. Navigate to http://localhost:3000
2. Select "2024 General Election" from dropdown
3. Select "President / Vice President" race
4. Click on any Madison ward
5. **Verify**: Tooltip shows comparison to 2020
6. **Verify**: Historical year shows "2020"
7. **Verify**: Both margins are reasonable (not 0%)

### 2. Mayor Race  
**Election**: Need to find a Mayor election
**Expected**: Should compare to previous Mayor race (2019 or 2023)

**Steps**:
1. Find election with Mayor race
2. Select that election
3. Select Mayor race
4. Click on Madison ward
5. **Verify**: Tooltip shows comparison to previous Mayor
6. **Verify**: Historical year is displayed
7. **Verify**: Margins are not 0%

### 3. Other Race Types
**Expected**: Should show NO comparison (0% is correct)

**Steps**:
1. Select any non-Presidential, non-Mayor race
2. Click on a ward
3. **Verify**: Tooltip shows current margin only
4. **Verify**: No historical comparison (or shows 0%)

## Quick Fix Needed

The current behavior is actually CORRECT. The issue is:
- User was looking at a race with no historical data
- System correctly shows 0% for historical margin
- But the UI doesn't make it clear that this is expected

**Recommendation**: Update tooltip to say "No historical data" instead of showing "0.0%"

## Testing Commands

```bash
# Find Presidential race in 2024
curl -s "https://api.danecounty.gov/api/v1/elections/races/172" | python3 -c "import sys, json; races = json.load(sys.stdin); [print(f\"{r['RaceNumber']}: {r['RaceName']}\") for r in races[:10]]"

# Find Mayor races
curl -s "https://api.danecounty.gov/api/v1/elections/list" | python3 -c "import sys, json; elections = json.load(sys.stdin); [print(f\"{e['ElectionId']}: {e['ElectionName']}\") for e in elections if 'Spring' in e['ElectionName'] and '202' in e['ElectionName']][:10]"
```

## Next Steps

1. Test with 2024 Presidential race (Election 172)
2. Verify historical data loads correctly
3. Test with Mayor race
4. Improve UI to show "No historical data available" when appropriate
