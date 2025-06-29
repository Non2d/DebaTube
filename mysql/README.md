# How To Dump
## Execute
(echo "SET FOREIGN_KEY_CHECKS=0;" && cat mysql/batch/debate_sotsuron.sql && echo "SET FOREIGN_KEY_CHECKS=1;") | docker exec -i db mysql -u root debate