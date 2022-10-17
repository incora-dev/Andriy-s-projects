import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { CustomText } from '../../index';
import ThemeContext from '../../../contexts/ThemeContext';
import { colors } from '../../../themes';

import styles from './styles';
import { types } from '../../../constants';
import { genericHelper } from '../../../helpers';
import { leadTrackerSelectors } from '../../../modules/leadTracker';

const TimelineLabel = ({ title, withBackground = false }) => {
  const { theme } = useContext(ThemeContext);

  const lowerCaseTitle = title?.toLocaleLowerCase();

  let textColor = '';
  switch (lowerCaseTitle) {
    case types.feedbackStatusType.NONE.toLocaleLowerCase():
      textColor = colors.$green_6;
      break;
    case types.feedbackStatusType.COLD.toLocaleLowerCase():
      textColor = colors.$blue_5;
      break;
    case types.feedbackStatusType.WARM.toLocaleLowerCase():
      textColor = colors.$orange_1;
      break;
    case types.feedbackStatusType.HOT.toLocaleLowerCase():
      textColor = colors.$orange;
      break;
    default:
      textColor = withBackground ? colors.$primary : theme.title;
  }

  return (
    <CustomText
      style={[
        styles.title,
        styles.constantWidth,
        { color: textColor },
        withBackground && [
          styles.withBackground,
          { backgroundColor: genericHelper.addAlphaToHex(textColor, 10), paddingHorizontal: 5 },
        ],
      ]}
    >
      {leadTrackerSelectors.getInterestLabelByStatus(title)}
    </CustomText>
  );
};

TimelineLabel.propTypes = {
  title: PropTypes.string.isRequired,
};

TimelineLabel.defaultProps = {};

export default TimelineLabel;
