export const publishEventMutation = /* GraphQL */ `
  mutation PublishEvent($shareId: String!, $event: SharedEventInput!) {
    publishEvent(shareId: $shareId, event: $event) {
      id
      title
    }
  }
`;

export const publishTimerStateMutation = /* GraphQL */ `
  mutation PublishTimerState($input: TimerStateInput!) {
    publishTimerState(input: $input) {
      shareId
      status
      timeInSeconds
      lastUpdatedAt
    }
  }
`;

export const publishCommandMutation = /* GraphQL */ `
  mutation PublishCommand($input: CommandInput!) {
    publishCommand(input: $input) {
      shareId
      type
      timestamp
    }
  }
`;

export const clearCommandMutation = /* GraphQL */ `
  mutation ClearCommand($shareId: String!) {
    clearCommand(shareId: $shareId)
  }
`;

export const removeSharedEventMutation = /* GraphQL */ `
  mutation RemoveSharedEvent($shareId: String!) {
    removeSharedEvent(shareId: $shareId)
  }
`;

export const saveUserEventMutation = /* GraphQL */ `
  mutation SaveUserEvent($input: UserEventInput!) {
    saveUserEvent(input: $input) {
      userId
      eventId
      updatedAt
    }
  }
`;

export const deleteUserEventMutation = /* GraphQL */ `
  mutation DeleteUserEvent($userId: String!, $eventId: String!) {
    deleteUserEvent(userId: $userId, eventId: $eventId)
  }
`;
