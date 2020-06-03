import { React } from 'react';
import { FormattedMessage, defineMessages } from 'react-intl';

export const MyComponent = () => {
  const messages = defineMessages({
    hello: {
      id: "Hello",
      defaultMessage: "Hello",
    },
    'hey.you': {
      id: "Hello, You",
      defaultMessage: "Hey, You!",
    }
  });

  return (
    <>
      <FormattedMessage {...messages.hello} />
      <FormattedMessage {...messages['hey.you']} />
    </>
  )
}
