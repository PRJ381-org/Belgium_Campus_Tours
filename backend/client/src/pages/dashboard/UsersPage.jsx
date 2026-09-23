import UsersPanel from '../../components/UsersPanel.jsx';

/**
 * Admin-only page listing dashboard accounts and their roles.
 */
export default function UsersPage(props) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <div className="breadcrumb">Home / <b>Users</b></div>
        </div>
      </div>
      <UsersPanel {...props} />
    </>
  );
}
