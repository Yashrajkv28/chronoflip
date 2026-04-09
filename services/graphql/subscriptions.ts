export const onTimerStateUpdate = /* GraphQL */ `
  subscription OnTimerStateUpdate($shareId: String!) {
    onTimerStateUpdate(shareId: $shareId) {
      shareId
      status
      currentSegmentIndex
      timeInSeconds
      segmentName
      segmentMode
      totalSegments
      activeAlertColor
      isFlashing
      lastUpdatedAt
      eventTitle
      scheduledStartTime
      activeGroupId
    }
  }
`;

export const onCommandUpdate = /* GraphQL */ `
  subscription OnCommandUpdate($shareId: String!) {
    onCommandUpdate(shareId: $shareId) {
      shareId
      type
      timestamp
    }
  }
`;

export const onUserEventChange = /* GraphQL */ `
  subscription OnUserEventChange($userId: String!) {
    onUserEventChange(userId: $userId) {
      userId
      eventId
      updatedAt
      deleted
    }
  }
`;
