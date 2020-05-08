import { React } from 'react';
import { FormattedMessage, defineMessages } from 'react-intl';

export const MyComponent = () => {
  const messages = defineMessages({
    hello: {
      id: "Hello",
      defaultMessage: "Hello",
    }
  });

  return (
    <FormattedMessage {...messages.hello} />
  )
}
