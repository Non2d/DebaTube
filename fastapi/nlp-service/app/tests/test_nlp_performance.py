# #!/usr/bin/env python3
# import sys
# import os
# import time
# import torch

# # Add the nlp-service app to path
# sys.path.append('./fastapi/nlp-service/app')

# from models.nlp_models import NLPModels

# def test_performance():
#     """
#     脳筋パフォーマンステスト - mockなし、実際の処理のみ
#     """
#     audio_file = "./storage/audio.wav"
    
#     if not os.path.exists(audio_file):
#         print(f"ERROR: {audio_file} not found")
#         return
    
#     print("=== NLP Performance Test ===")
#     print(f"Audio file: {audio_file}")
#     print(f"CUDA available: {torch.cuda.is_available()}")
#     print(f"CUDA device count: {torch.cuda.device_count()}")
    
#     # Initialize models
#     print("\n1. Initializing NLP models...")
#     start_init = time.time()
#     nlp = NLPModels()
#     init_time = time.time() - start_init
#     print(f"   Models initialized in {init_time:.2f}s")
#     print(f"   Device: {nlp.device}")
#     print(f"   Torch dtype: {nlp.torch_dtype}")
    
#     # Test Speech Recognition
#     print("\n2. Testing Speech Recognition...")
#     start_asr = time.time()
#     try:
#         transcription = nlp.transcribe_audio(audio_file, "english")
#         asr_time = time.time() - start_asr
#         print(f"   Speech recognition completed in {asr_time:.2f}s")
#         print(f"   Chunks processed: {len(transcription)}")
#         if transcription:
#             print(f"   Sample text: {transcription[0]['text'][:100]}...")
#     except Exception as e:
#         asr_time = time.time() - start_asr
#         print(f"   Speech recognition FAILED in {asr_time:.2f}s")
#         print(f"   Error: {e}")
#         return
    
#     # Test Speaker Diarization
#     print("\n3. Testing Speaker Diarization...")
#     start_diar = time.time()
#     try:
#         speakers = nlp.diarize_speakers(audio_file)
#         diar_time = time.time() - start_diar
#         print(f"   Speaker diarization completed in {diar_time:.2f}s")
#         print(f"   Segments found: {len(speakers)}")
#         if speakers:
#             print(f"   Sample segment: {speakers[0]}")
#     except Exception as e:
#         diar_time = time.time() - start_diar
#         print(f"   Speaker diarization FAILED in {diar_time:.2f}s")
#         print(f"   Error: {e}")
#         return
    
#     # Results
#     total_time = init_time + asr_time + diar_time
#     print("\n=== PERFORMANCE RESULTS ===")
#     print(f"Initialization: {init_time:.2f}s")
#     print(f"Speech Recognition: {asr_time:.2f}s")
#     print(f"Speaker Diarization: {diar_time:.2f}s")
#     print(f"TOTAL TIME: {total_time:.2f}s")
    
#     # Pass/Fail
#     if total_time <= 30:
#         print(f"✅ PASS - Under 30s target")
#     else:
#         print(f"❌ FAIL - Over 30s target ({total_time:.2f}s)")

# if __name__ == "__main__":
#     test_performance()