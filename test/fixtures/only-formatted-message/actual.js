import { React } from 'react';
import { FormattedMessage, FormattedHTMLMessage } from 'react-intl';

export const MyComponent = () => {
  return (
    <>
      <FormattedHTMLMessage 
        id="app.greeting" 
        defaultMessage="Hello {name}" 
        values={{
          name: 'Hao',
        }}
      />
      <FormattedMessage id="app.status" defaultMessage="Online" />
    </>
  )
}
