"""
Macro-Structural Features Calculator

This module implements algorithms to calculate four macro-structural features of rebuttals in parliamentary debates:
1. Distance: Measures temporal distance of rebuttals across speeches
2. Rally: Measures connectivity of rebuttal chains (A→B→C patterns)  
3. Interval: Measures dispersion of rebuttals within speeches
4. Order: Measures crossing patterns of rebuttals from same speech
"""

from typing import Dict, Any, List, Tuple
from itertools import combinations


def l_func(round_data: Dict[str, Any], adu_id: int) -> Dict[str, Any]:
    """Helper function to get speech information for an ADU ID"""
    for speech_idx, speech in enumerate(round_data["speeches"]):
        for au in speech["argument_units"]:
            if au["sequence_id"] == adu_id:
                return {"speech_id": speech_idx}
    raise ValueError(f"ADU ID {adu_id} not found in round data")


def calc_distance(round_data: Dict[str, Any], attacks: List[Tuple[int, int]], 
                 len_att_src_by_speech: List[int], version: int = 1) -> float:
    """
    Calculate Distance feature (Far Rebuttal)
    
    Args:
        round_data: Original JSON structure of a debate round
        attacks: List of attack tuples (src, dst)
        len_att_src_by_speech: Number of attacks from each speech
        version: Algorithm version
        
    Returns:
        Distance score as float
    """
    slen = len(round_data["speeches"])
    fs_far = {"speech": {"len": [0] * slen}, "round": {"len": 0, "ratio": 0}}
    
    for src, dst in attacks:
        src_speech_id = l_func(round_data, src)["speech_id"]
        dst_speech_id = l_func(round_data, dst)["speech_id"]
        dist = src_speech_id - dst_speech_id
        
        if dist >= 3 or (src_speech_id != slen - 2 and dist >= 2):
            fs_far["speech"]["len"][src_speech_id] += 1
    
    fs_far["round"]["len"] = sum(fs_far["speech"]["len"])
    
    # 4番目以降のスピーチからの総反論数
    total_attacks_from_4th = sum(len_att_src_by_speech[3:]) if len(len_att_src_by_speech) > 3 else 0
    
    if total_attacks_from_4th == 0:
        return 0.0
    
    fs_far["round"]["ratio"] = fs_far["round"]["len"] / total_attacks_from_4th
    
    if version == 1:
        distance_value = fs_far["round"]["ratio"]
    else:
        raise ValueError("Invalid version for distance calculation.")
    
    return distance_value


def calc_interval(att_src_by_speech: List[List[Tuple[int, int]]], 
                 len_adu_by_speech: List[int], version: int = 1) -> float:
    """
    Calculate Interval feature
    
    Args:
        att_src_by_speech: Attacks grouped by source speech
        len_adu_by_speech: Number of ADUs in each speech
        version: Normalization update
            1: simple normalization
            2: minimum interval considered
        
    Returns:
        Sum of normalized intervals
    """
    att_dst_adu_src = []
    tmp_att_dst_adu_src = {}
    
    for atts in att_src_by_speech:
        for att in atts:
            if att[1] in tmp_att_dst_adu_src:
                tmp_att_dst_adu_src[att[1]].append(att)
            else:
                tmp_att_dst_adu_src[att[1]] = [att]
                
        tmp_att_dst_adu_src = {key: value for key, value in tmp_att_dst_adu_src.items() if len(value) > 1}
        tmp_att_dst_adu_src = list(tmp_att_dst_adu_src.values())
        att_dst_adu_src.append(tmp_att_dst_adu_src)
        tmp_att_dst_adu_src = {}

    intervals_normalized = []
    
    for j, atts in enumerate(att_dst_adu_src):
        speech_len = len_adu_by_speech[j]
        
        for att in atts:
            tmp_x = att[-1][0] - att[0][0] - 1  # スピーチ内の間隔の総和
            
            if version == 1:
                # intervals_normalized2 (シンプルな正規化)
                if speech_len > 2:
                    intervals_normalized.append(tmp_x / (speech_len - 2))
            
            elif version == 2:
                # intervals_normalized (最小間隔を考慮した正規化)
                tmp_min = len(att) - 2  # 最小可能間隔
                tmp_max = speech_len - len(att)  # 最大可能間隔
                if tmp_max != 0:
                    intervals_normalized.append((tmp_x - tmp_min) / tmp_max)
                else:
                    intervals_normalized.append(0)
            
            else:
                raise ValueError("Invalid version for interval calculation.")
    
    # 最終結果は総和（平均ではない）
    return sum(intervals_normalized)


def calc_order(att_src_by_speech: List[List[Tuple[int, int]]], 
              attacks: List[Tuple[int, int]], poi_adus: List[int],
              version: int = 1) -> float:
    """
    Calculate Order feature
    
    Args:
        att_src_by_speech: Attacks grouped by source speech
        attacks: List of all attack tuples
        poi_adus: List of POI ADU IDs
        version: Algorithm version
        
    Returns:
        Order score (inverse of correspondence ratio)
    """
    # POI attacks
    atts_from_POI = []
    for att in attacks:
        if att[0] in poi_adus:
            atts_from_POI.append(att)
    
    # スピーチごとに反論の組を列挙
    reb_src_shared = 0
    reb_dst_shared = 0
    reb_crossed = 0
    
    for i, att_s in enumerate(att_src_by_speech):
        for att_pair in combinations(att_s, 2):
            if att_pair[0][0] in poi_adus or att_pair[1][0] in poi_adus:  # POI絡みの反論は除外
                continue
            elif att_pair[0][0] == att_pair[1][0]:
                reb_src_shared += 1
            elif att_pair[0][1] == att_pair[1][1]:
                reb_dst_shared += 1
            elif att_pair[0][1] > att_pair[1][1]:  # 完全に交差する条件
                reb_crossed += 1
    
    reb_num = len(attacks) - len(atts_from_POI)
    
    if reb_num == 0 or (reb_src_shared + reb_crossed) == 0:
        return -1.0
    
    if version == 1:
        order_value = reb_num / (reb_src_shared + reb_crossed)
    elif version == 2:
        order_value = reb_num / (reb_src_shared + reb_dst_shared + reb_crossed)
    elif version == 3:
        order_value = reb_num / reb_crossed if reb_crossed > 0 else -1.0
    elif version == 4:
        order_value = (reb_src_shared + reb_crossed) / reb_num
    else:
        raise ValueError("Invalid version for order calculation.")
    
    return order_value


def filter_rally(arrays_list):
    """Filter rally duplicates"""
    if not arrays_list:
        return []
    
    rev = list(reversed(arrays_list))
    result = rev[0]  # 最長ターンは確定で採用
    for i in range(1, len(arrays_list)):
        for rally in rev[i]:
            if not any(all(item in condition for item in rally) for condition in result):
                result.append(rally)
    return result


def calc_rally(attacks: List[Tuple[int, int]], num_speeches: int, version: int = 1) -> float:
    """
    Calculate Rally feature
    
    Args:
        attacks: List of attack tuples (src, dst)
        num_speeches: Number of speeches
        version: Algorithm version
        
    Returns:
        Rally score (total rally / num_rebuttals / num_speeches)
    """
    if not attacks:
        return 0.0
    
    att_rally_lists = []
    att_2_list = []
    
    # Find 2-attack rallies
    for att1 in reversed(attacks):
        for att2 in [att_dst_candidate for att_dst_candidate in reversed(attacks) if att_dst_candidate[0] < att1[0]]:
            if att1[1] == att2[0]:
                att_2_list.append([att1, att2])
    
    att_rally_lists.append(att_2_list)
    
    # Extend to longer rallies
    att_n_list = [0]
    while len(att_n_list) > 0:
        att_n_list = []
        for rally in reversed(att_rally_lists[-1]):
            for att_dst in [att_dst_candidate for att_dst_candidate in reversed(attacks) if att_dst_candidate[0] < rally[-1][0]]:
                if rally[-1][1] == att_dst[0]:
                    att_n_list.append(rally + [att_dst])
        if len(att_n_list) > 0:
            att_rally_lists.append(att_n_list)
    
    # Filter rallies to remove duplicates
    att_rally_lists_filtered = filter_rally(att_rally_lists)
    
    if not att_rally_lists_filtered:
        return 0.0
    
    # ノーラリー（単体の反論）も含めて全反論をカバー
    att_noRally_list = [[att] for att in attacks if not any(att in att_list for att_list in att_rally_lists_filtered)]
    raw_list = list(reversed(att_rally_lists_filtered + att_noRally_list))
    
    if not raw_list:
        return 0.0
        
    # 最大ラリー長を計算
    max_rally_len = max(len(rally_content) for rally_content in raw_list) if raw_list else 1
    rally_grouped_by_len = [[] for _ in range(max_rally_len)]
    
    for rally_content in raw_list:
        rally_grouped_by_len[len(rally_content) - 1].append(rally_content)
    
    rally_len_list_grouped = [len(sublist) for sublist in rally_grouped_by_len]
    total_rally = sum(rally_len_list_grouped[i] * i for i in range(len(rally_len_list_grouped)))
    
    num_rebuttals = len(attacks)
    
    if num_speeches == 0 or num_rebuttals == 0:
        return 0.0
    
    if version == 1:
        rally_value = total_rally / num_rebuttals / num_speeches
    else:
        raise ValueError("Invalid version for rally calculation.")

    return rally_value


def calculate_features(round_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate all four macro-structural features for a debate round
    
    Args:
        round_data: Round data in RoundBatchResponse format
        
    Returns:
        Dictionary with feature scores
    """
    # Extract attacks (rebuttals) from round data
    attacks = [(reb["src"], reb["tgt"]) for reb in round_data["rebuttals"]]
    
    if not attacks:
        return {
            "distance": 0.0,
            "interval": 0.0,
            "order": -1.0,
            "rally": 0.0
        }
    
    # Get POI ADU IDs
    poi_adus = round_data["pois"]
    
    # Get number of speeches
    num_speeches = len(round_data["speeches"])
    
    # Group attacks by source speech
    att_src_by_speech = [[] for _ in range(num_speeches)]
    len_att_src_by_speech = [0] * num_speeches
    len_adu_by_speech = []
    
    # Calculate ADUs per speech and group attacks
    for speech_idx, speech in enumerate(round_data["speeches"]):
        len_adu_by_speech.append(len(speech["argument_units"]))
        
    for src, dst in attacks:
        # Find source speech
        for speech_idx, speech in enumerate(round_data["speeches"]):
            for au in speech["argument_units"]:
                if au["sequence_id"] == src:
                    att_src_by_speech[speech_idx].append((src, dst))
                    len_att_src_by_speech[speech_idx] += 1
                    break
    
    # Calculate features
    try:
        distance = calc_distance(round_data, attacks, len_att_src_by_speech)
    except Exception:
        distance = 0.0
        
    try:
        interval = calc_interval(att_src_by_speech, len_adu_by_speech)
    except Exception:
        interval = 0.0
        
    try:
        order = calc_order(att_src_by_speech, attacks, poi_adus)
    except Exception:
        order = -1.0
        
    try:
        rally = calc_rally(attacks, num_speeches)
    except Exception:
        rally = 0.0
    
    return {
        "distance": distance,
        "interval": interval,
        "order": order,
        "rally": rally
    }