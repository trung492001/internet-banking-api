import db from '../utils/db.js'

export default function (tableName) {
  return {
    findAll (viewModel) {
      return db(tableName).select(viewModel)
    },
    add (entity, viewModel) {
      return db(tableName).insert(entity).returning(viewModel)
    },
    update (id, entity, viewModel) {
      return db(tableName).where({ id }).update(entity).returning(viewModel)
    },
    find (fieldAndValue, viewModel) {
      return db(tableName).where(fieldAndValue).returning(viewModel).first()
    },
    delete (id) {
      return db(tableName).where({ id }).delete()
    }
  }
}
