class ApiFeature {
  constructor(query, queryString, isAggregate = false) {
    this.query = query;
    this.queryString = queryString;
    this.isAggregate = isAggregate;
    this.pipeline = [];
    this.matchStage = {};
    this.sortStage = {};
  }
  filter() {
    const queryObjec = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el) => delete queryObjec[el]);
    let queryStr = JSON.stringify(queryObjec);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    const filter = JSON.parse(queryStr);
    if (this.isAggregate) {
      this.matchStage = { $match: filter };
    } else {
      this.query = this.query.find(filter);
    }
    return this;
  }
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.trim().split(",").join(" ");

      const sortByObject = {};
      sortBy.split(" ").forEach((field) => {
        if (!field) return;
        const direction = field.trim().startsWith("-") ? -1 : 1;
        const fieldName = field.trim().replace(/^-/, "");
        sortByObject[fieldName] = direction;
      });

      if (this.isAggregate) {
        this.sortStage = { $sort: sortByObject };
      } else {
        this.query = this.query.sort(sortBy);
      }
    } else {
      if (this.isAggregate) {
        this.pipeline.push({ $sort: { createdAt: -1 } });
      } else {
        this.query = this.query.sort({ createdAt: -1 });
      }
    }
    return this;
  }
  pageLimit() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    if (this.isAggregate) {
      this.pipeline.push({ $skip: skip }, { $limit: limit });
    } else {
      this.query = this.query.skip(skip).limit(limit);
    }
    return this;
  }

  build() {
    return this.isAggregate ? this.pipeline : this.query;
  }
}

module.exports = ApiFeature;
