import React, { useContext } from 'react';
import { TouchableWithoutFeedback, View } from 'react-native';
import PropTypes from 'prop-types';

import { connect } from 'react-redux';
import { ChevronRightIcon, CustomText } from '../../index';
import { dateHelper } from '../../../helpers';
import { metrics, colors } from '../../../themes';
import ThemeContext from '../../../contexts/ThemeContext';
import { Timestamp } from '../../../shapes';

import styles from './styles';
import TimelineLabel from '../TimeLineLabel';
import { general, types } from '../../../constants';

const LeadTrackerTimelineItem = ({
  deviceType,
  title,
  titles,
  label,
  date,
  isFirst,
  isLast,
  highlight,
  onPress,
  disabled,
  rightIcon,
  children,
  hasBottomBorder,
  labelSecondary,
  showAdditionalIndicator,
}) => {
  const { theme } = useContext(ThemeContext);
  const days = date ? dateHelper.formatDate(date, 'DD') : '';
  const month = date ? dateHelper.formatDate(date, 'MMM') : '';

  const indicatorLineStyles = [styles.indicatorLine, { backgroundColor: theme.separator }];
  const indicatorHighlightStyles = highlight ? [styles.indicatorDotHighlight, { borderColor: theme.indicator }] : null;

  return (
    <View style={[styles.row, showAdditionalIndicator && !isLast && styles.overlapBottomMargin]}>
      <View style={styles.date}>
        <CustomText style={[styles.days, { color: theme.title }]}>{days}</CustomText>
        <CustomText style={[styles.month, { color: theme.textPlaceholder }]}>{month}</CustomText>
      </View>
      <View style={styles.indicator}>
        <View style={[indicatorLineStyles, isFirst ? styles.indicatorLineHidden : null]} />
        <View style={[styles.indicatorDot, { borderColor: theme.backgroundDark }, indicatorHighlightStyles]} />
        <View style={[indicatorLineStyles, isLast ? styles.indicatorLineHidden : null]} />
        {showAdditionalIndicator && !isLast && (
          <View style={[styles.indicator, styles.additionalIndicator]}>
            <View style={[indicatorLineStyles, styles.additionalLine]} />
            <View
              style={[
                styles.indicatorDot,
                { borderColor: theme.backgroundDark, backgroundColor: theme.backgroundDark },
              ]}
            />
          </View>
        )}
      </View>
      <TouchableWithoutFeedback onPress={onPress} disabled={disabled}>
        <View
          style={[
            styles.container,
            isLast || !hasBottomBorder ? styles.noBottomBorder : { borderBottomColor: theme.separator },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.labelContainer}>
              {!!labelSecondary && (
                <CustomText style={[styles.topLabel, { color: theme.textPlaceholder }]}>{labelSecondary}</CustomText>
              )}
              <View style={[styles.endContent]}>
                {rightIcon || <ChevronRightIcon stroke={colors.$primary} size={metrics.$unitOnePointFive} />}
              </View>
            </View>

            <CustomText numberOfLines={2} style={[styles.label, { color: theme.eventDescription }]}>
              {label}
            </CustomText>
            {title && <TimelineLabel title={title} withBackground={true} />}
            <View style={styles.row}>
              {titles?.map((item, index) => (
                <View
                  key={item}
                  style={[
                    deviceType !== types.deviceType.TABLET &&
                      index >= general.leadTrackerTimeLineItemsToShow &&
                      styles.withMarginTop,
                    index &&
                      (index % general.leadTrackerTimeLineItemsToShow || deviceType === types.deviceType.TABLET) &&
                      styles.withMarginLeftOne,
                  ]}
                >
                  {item && <TimelineLabel title={item} withBackground={true} containerStyle={styles.withMarginTop} />}
                </View>
              ))}
            </View>
          </View>
          {children}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

LeadTrackerTimelineItem.propTypes = {
  deviceType: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  date: Timestamp,
  isFirst: PropTypes.bool.isRequired,
  isLast: PropTypes.bool.isRequired,
  highlight: PropTypes.bool,
  rightIcon: PropTypes.node,
  onPress: PropTypes.func,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  hasBottomBorder: PropTypes.bool,
  labelSecondary: PropTypes.string,
  showAdditionalIndicator: PropTypes.bool,
};

LeadTrackerTimelineItem.defaultProps = {
  highlight: false,
  rightIcon: null,
  onPress: () => {},
  disabled: false,
  children: null,
  hasBottomBorder: false,
  date: null,
  labelSecondary: '',
  showAdditionalIndicator: false,
};

const mapStateToProps = ({ device }) => ({
  deviceType: device.deviceType,
});

export default connect(mapStateToProps, null)(LeadTrackerTimelineItem);
