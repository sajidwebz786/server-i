const ApiError = require('../utils/apiError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return next(new ApiError(422, 'Validation failed', error.details.map((item) => item.message)));
    }

    req[source] = value;
    return next();
  };
}

module.exports = validate;
