export const getSharedEvent = /* GraphQL */ `
  query GetSharedEvent($shareId: String!) {
    getSharedEvent(shareId: $shareId) {
      id
      title
      venueName
      segments {
        id
        name
        durationSeconds
        mode
        color
        groupId
      }
      groups {
        id
        name
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
      activeGroupId
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
