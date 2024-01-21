CREATE TABLE snowdepth (
  timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  distance REAL,
  confidence SMALLINT
);

CREATE INDEX idx_sd_timestamp ON snowdepth (timestamp);
CREATE INDEX idx_sd_distance ON snowdepth (distance);
CREATE INDEX idx_sd_confidence ON snowdepth (confidence);
CREATE INDEX idx_sd_timestamp_distance ON snowdepth (timestamp_without_timezone, distance);
