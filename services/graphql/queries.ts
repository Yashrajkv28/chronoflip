export const getSharedEvent = /* GraphQL */ `
  query GetSharedEvent($shareId: String!) {
    getSharedEvent(shareId: $shareId) {
      id
      title
      segments {
        id
        name
        durationSeconds
        mode
        color
      }
      scheduledStartTime
    }
  }
`;

export const getTimerState = /* GraphQL */ `
  query GetTimerState($shareId: String!) {
    getTimerState(shareId: $shareId) {
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
    }
  }
`;

export const listUserEvents = /* GraphQL */ `
  query ListUserEvents($userId: String!) {
    listUserEvents(userId: $userId) {
      userId
      eventId
      data
      updatedAt
    }
  }
`;
