-- queuedAt now always equals receivedAt; reset rows that inherited an earlier ship's position
UPDATE "Submission" SET "queuedAt" = "receivedAt" WHERE "queuedAt" <> "receivedAt";
