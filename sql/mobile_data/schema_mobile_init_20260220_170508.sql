-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: localhost    Database: debate
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `adus`
--
CREATE TABLE `adus` (
  `id` int NOT NULL AUTO_INCREMENT,
  `speech_id` int NOT NULL,
  `first_sentence_id` int NOT NULL,
  `last_sentence_id` int NOT NULL,
  `text` text NOT NULL,
  `role` varchar(64) NOT NULL,
  `start_time` float NOT NULL,
  `end_time` float NOT NULL,
  PRIMARY KEY (`id`),
  KEY `first_sentence_id` (`first_sentence_id`),
  KEY `last_sentence_id` (`last_sentence_id`),
  KEY `ix_adus_id` (`id`),
  KEY `ix_adus_speech_id` (`speech_id`),
  CONSTRAINT `adus_ibfk_1` FOREIGN KEY (`first_sentence_id`) REFERENCES `sentences` (`id`),
  CONSTRAINT `adus_ibfk_2` FOREIGN KEY (`last_sentence_id`) REFERENCES `sentences` (`id`),
  CONSTRAINT `adus_ibfk_3` FOREIGN KEY (`speech_id`) REFERENCES `speeches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adus`
--;

CREATE TABLE `external_videos` (
  `video_id` varchar(255) NOT NULL,
  `title` text,
  `description` text,
  `published_at` datetime DEFAULT NULL,
  `channel_id` varchar(255) DEFAULT NULL,
  `channel_title` varchar(255) DEFAULT NULL,
  `thumbnail_url` text,
  `tags` json DEFAULT NULL,
  `category_id` varchar(50) DEFAULT NULL,
  `yt_transcript` mediumtext,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`video_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `external_videos`
--;

CREATE TABLE `rebuttals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `src_adu_id` int NOT NULL,
  `tgt_adu_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rebuttals_src` (`src_adu_id`),
  KEY `idx_rebuttals_tgt` (`tgt_adu_id`),
  KEY `ix_rebuttals_id` (`id`),
  CONSTRAINT `rebuttals_ibfk_1` FOREIGN KEY (`src_adu_id`) REFERENCES `adus` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rebuttals_ibfk_2` FOREIGN KEY (`tgt_adu_id`) REFERENCES `adus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rebuttals`
--;

CREATE TABLE `rounds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `try_count` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `note` text,
  `style` varchar(50) NOT NULL,
  `motion` text,
  `tags` varchar(255) DEFAULT NULL,
  `video_id` varchar(255) DEFAULT NULL,
  `owner_id` varchar(255) DEFAULT NULL,
  `raw_transcription` json DEFAULT NULL,
  `info_slide` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_rounds_name_try_count` (`name`,`try_count`),
  KEY `ix_rounds_id` (`id`),
  KEY `ix_rounds_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rounds`
--;

CREATE TABLE `sentences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `round_id` int NOT NULL,
  `text` text NOT NULL,
  `first_word_id` int NOT NULL,
  `last_word_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `first_word_id` (`first_word_id`),
  KEY `last_word_id` (`last_word_id`),
  KEY `ix_sentences_id` (`id`),
  KEY `ix_sentences_round_id` (`round_id`),
  CONSTRAINT `sentences_ibfk_1` FOREIGN KEY (`first_word_id`) REFERENCES `words` (`id`),
  CONSTRAINT `sentences_ibfk_2` FOREIGN KEY (`last_word_id`) REFERENCES `words` (`id`),
  CONSTRAINT `sentences_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=285 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sentences`
--;

CREATE TABLE `speeches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `round_id` int NOT NULL,
  `position` varchar(64) NOT NULL,
  `audio_path` varchar(512) DEFAULT NULL,
  `duration` float DEFAULT NULL,
  `raw_transcription` json DEFAULT NULL,
  `first_sentence_id` int DEFAULT NULL,
  `last_sentence_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `first_sentence_id` (`first_sentence_id`),
  KEY `last_sentence_id` (`last_sentence_id`),
  KEY `fk_speeches_round_id` (`round_id`),
  KEY `ix_speeches_id` (`id`),
  CONSTRAINT `speeches_ibfk_1` FOREIGN KEY (`first_sentence_id`) REFERENCES `sentences` (`id`),
  CONSTRAINT `speeches_ibfk_2` FOREIGN KEY (`last_sentence_id`) REFERENCES `sentences` (`id`),
  CONSTRAINT `speeches_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `speeches`
--;

CREATE TABLE `words` (
  `id` int NOT NULL AUTO_INCREMENT,
  `round_id` int NOT NULL,
  `text` varchar(255) NOT NULL,
  `start_time` float NOT NULL,
  `end_time` float NOT NULL,
  `confidence` float DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_words_id` (`id`),
  KEY `ix_words_round_id` (`round_id`),
  CONSTRAINT `words_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4919 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `words`
--;

/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-20 17:05:09
