#!/usr/bin/env python3
"""
Test script to compare CSV features with API results
"""

import requests
import pandas as pd
import json
import numpy as np

def load_csv_features(csv_path):
    """Load expected features from CSV file"""
    df = pd.read_csv(csv_path, index_col=0)
    
    # CSV data has Japanese column names
    feature_mapping = {
        '反論の遠さ': 'distance',
        '反論のラリー度合い': 'rally', 
        '反論先が共通する反論の総間隔': 'interval',
        '反論の順序の対応度': 'order'
    }
    
    expected_features = {}
    for i, column in enumerate(df.columns):
        round_name = column
        expected_features[round_name] = {}
        for jp_name, en_name in feature_mapping.items():
            expected_features[round_name][en_name] = df.loc[jp_name, column]
    
    return expected_features

def get_api_features():
    """Get features from API"""
    try:
        response = requests.get('http://localhost:8080/batch-rounds-with-features')
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error calling API: {e}")
        return None

def compare_features(expected, api_results):
    """Compare expected vs actual features"""
    if not api_results:
        print("No API results to compare")
        return
    
    print("Feature Comparison Results:")
    print("=" * 60)
    
    # Create mapping between CSV names and likely API titles
    csv_to_api_mapping = {
        'か弱い女性像': '女性ヒーロー',
        '酩酊弁護の廃止': '酩酊弁護',
        '子無し世帯への課税': '子なし世帯',
        '警察の暴力の投稿奨励': 'police brutality',
        '政治家の私生活報道': '政治家の私生活',
        '暴力団の違法化': '暴力団',
        '受刑者の投票許可': '受刑者',
        '決闘の合法化': 'デュエル',
        'テレワーク': 'テレワーク',
        '女性ヒーローリーダー': '女性ヒーロー',
        '性産業国有化': '性産業',
        '厳格な子育ての禁止': 'tiger parenting',
        '高齢の親との同居': '親との同居',
        '禁欲的生活': '禁欲',
        '議会女性枠の導入': '女性枠',
        '高校生のバイト': 'バイト',
        '治療拒否権への介入': '治療拒否',
        '身代金違法化1': '身代金',
        '身代金違法化2': '身代金',
        '医療特許の公開': '医療特許'
    }
    
    # Group API results
    api_rounds = []
    for i, round_data in enumerate(api_results):
        title = round_data.get('title', round_data.get('description', f'Round_{i}'))
        api_rounds.append((title, round_data['features']))
    
    print(f"CSV rounds: {len(expected)}")
    print(f"API rounds: {len(api_results)}")
    print()
    
    # List all API titles for manual checking
    print("API Round Titles:")
    for i, (title, _) in enumerate(api_rounds):
        print(f"  {i}: {title}")
    print()
    
    # Since we can't easily match by title, let's compare by order
    # The CSV and API should return rounds in the same order
    feature_names = ['distance', 'rally', 'interval', 'order']
    differences = {feat: [] for feat in feature_names}
    
    csv_names = list(expected.keys())
    
    for i, (csv_name, expected_feat) in enumerate(expected.items()):
        if i >= len(api_rounds):
            print(f"Round {i} ({csv_name}): No corresponding API result")
            continue
            
        api_title, api_feat = api_rounds[i]
        print(f"Round {i}:")
        print(f"  CSV: {csv_name}")
        print(f"  API: {api_title}")
        print(f"  Features comparison:")
        
        for feat in feature_names:
            expected_val = expected_feat[feat]
            api_val = api_feat[feat]
            diff = abs(expected_val - api_val)
            differences[feat].append(diff)
            
            print(f"    {feat}: {expected_val:.6f} vs {api_val:.6f} (diff: {diff:.6f})")
        print()
    
    # Summary statistics
    print("Summary Statistics:")
    print("-" * 30)
    for feat in feature_names:
        if differences[feat]:
            diffs = np.array(differences[feat])
            print(f"{feat}:")
            print(f"  Mean absolute difference: {np.mean(diffs):.6f}")
            print(f"  Max difference: {np.max(diffs):.6f}")
            print(f"  Min difference: {np.min(diffs):.6f}")
            print(f"  Std difference: {np.std(diffs):.6f}")
            accuracy = np.mean(diffs < 0.001)  # Consider <0.001 as "accurate"
            print(f"  Accuracy (diff < 0.001): {accuracy*100:.1f}%")
        else:
            print(f"{feat}: No matching data")

def main():
    """Main test function"""
    csv_path = '/Users/electra/Desktop/server_side_study/DebateViz/DebateVizSystem/data/structual_features.csv'
    
    print("Loading expected features from CSV...")
    expected = load_csv_features(csv_path)
    
    print("Getting features from API...")
    api_results = get_api_features()
    
    if api_results:
        print(f"API returned {len(api_results)} rounds")
        print("Sample API result:")
        print(json.dumps(api_results[0]['features'], indent=2))
        print()
        
        compare_features(expected, api_results)
    else:
        print("Failed to get API results")

if __name__ == "__main__":
    main()